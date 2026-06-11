import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { SecurityGroupSet } from './security';
import { TaskRoleSet } from './iam';
import { getTags } from './config';

export interface ComputeResources {
  cluster: aws.ecs.Cluster;
  apiRepository: aws.ecr.Repository;
  workerRepository: aws.ecr.Repository;
  apiService: aws.ecs.Service;
  workerService: aws.ecs.Service;
  alb: aws.lb.LoadBalancer;
  apiTargetGroup: aws.lb.TargetGroup;
  albListener: aws.lb.Listener;
}

export function createCompute(
  privateSubnetIds: pulumi.Output<string>[],
  publicSubnetIds: pulumi.Output<string>[],
  sg: SecurityGroupSet,
  roles: TaskRoleSet,
  vpcId: pulumi.Output<string>,
  apiPort: number,
  apiCpu: string,
  apiMemory: string,
  apiDesiredCount: number,
  workerCpu: string,
  workerMemory: string,
  workerDesiredCount: number,
  domainName: string,
  certificateArn: string,
  dbConnectionUrl: pulumi.Output<string>,
  redisEndpoint: pulumi.Output<string>,
  storageBucket: pulumi.Output<string>,
): ComputeResources {
  const tags = getTags();

  const apiRepository = new aws.ecr.Repository('pia-api-repo', {
    name: 'pia-api',
    imageTagMutability: 'IMMUTABLE',
    imageScanningConfiguration: {
      scanOnPush: true,
    },
    forceDelete: false,
    tags: { ...tags, Name: 'pia-api-repo' },
  });

  const workerRepository = new aws.ecr.Repository('pia-worker-repo', {
    name: 'pia-worker',
    imageTagMutability: 'IMMUTABLE',
    imageScanningConfiguration: {
      scanOnPush: true,
    },
    forceDelete: false,
    tags: { ...tags, Name: 'pia-worker-repo' },
  });

  const cluster = new aws.ecs.Cluster('pia-cluster', {
    name: 'pia-cluster',
    settings: [{ name: 'containerInsights', value: 'enabled' }],
    tags: { ...tags, Name: 'pia-cluster' },
  });

  const apiLogGroup = new aws.cloudwatch.LogGroup('pia-api-logs', {
    name: '/ecs/pia-api',
    retentionInDays: 30,
    tags,
  });

  const workerLogGroup = new aws.cloudwatch.LogGroup('pia-worker-logs', {
    name: '/ecs/pia-worker',
    retentionInDays: 30,
    tags,
  });

  const apiTaskDef = pulumi
    .all([apiRepository.repositoryUrl, dbConnectionUrl, redisEndpoint, storageBucket])
    .apply(([repoUrl, dbUrl, redisUrl, bucket]) => {
      const containerDefs = [
        {
          name: 'api',
          image: `${repoUrl}:latest`,
          portMappings: [{ containerPort: apiPort, protocol: 'tcp' }],
          essential: true,
          environment: [
            { name: 'NODE_ENV', value: 'production' },
            { name: 'PORT', value: String(apiPort) },
            { name: 'HOST', value: '0.0.0.0' },
            { name: 'LOG_LEVEL', value: 'info' },
            { name: 'LOG_FORMAT', value: 'json' },
            { name: 'DATABASE_URL', value: dbUrl },
            { name: 'REDIS_URL', value: redisUrl },
            { name: 'STORAGE_BUCKET', value: bucket },
            { name: 'STORAGE_ENDPOINT', value: 'https://s3.amazonaws.com' },
          ],
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': apiLogGroup.name,
              'awslogs-region': aws.getRegionOutput().name,
              'awslogs-stream-prefix': 'api',
            },
          },
          healthCheck: {
            command: ['CMD-SHELL', `wget -qO- http://localhost:${apiPort}/health || exit 1`],
            interval: 30,
            timeout: 5,
            retries: 3,
            startPeriod: 30,
          },
        },
      ];

      return new aws.ecs.TaskDefinition('pia-api-task', {
        family: 'pia-api',
        networkMode: 'awsvpc',
        requiresCompatibilities: ['FARGATE'],
        cpu: apiCpu,
        memory: apiMemory,
        executionRoleArn: roles.apiExecutionRole.arn,
        taskRoleArn: roles.apiTaskRole.arn,
        containerDefinitions: pulumi.jsonStringify(containerDefs),
        tags: { ...tags, Name: 'pia-api-task' },
      });
    });

  const workerTaskDef = pulumi
    .all([workerRepository.repositoryUrl, dbConnectionUrl, redisEndpoint, storageBucket])
    .apply(([repoUrl, dbUrl, redisUrl, bucket]) => {
      const containerDefs = [
        {
          name: 'worker',
          image: `${repoUrl}:latest`,
          essential: true,
          environment: [
            { name: 'NODE_ENV', value: 'production' },
            { name: 'LOG_LEVEL', value: 'info' },
            { name: 'LOG_FORMAT', value: 'json' },
            { name: 'DATABASE_URL', value: dbUrl },
            { name: 'REDIS_URL', value: redisUrl },
            { name: 'STORAGE_BUCKET', value: bucket },
            { name: 'STORAGE_ENDPOINT', value: 'https://s3.amazonaws.com' },
          ],
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': workerLogGroup.name,
              'awslogs-region': aws.getRegionOutput().name,
              'awslogs-stream-prefix': 'worker',
            },
          },
        },
      ];

      return new aws.ecs.TaskDefinition('pia-worker-task', {
        family: 'pia-worker',
        networkMode: 'awsvpc',
        requiresCompatibilities: ['FARGATE'],
        cpu: workerCpu,
        memory: workerMemory,
        executionRoleArn: roles.workerExecutionRole.arn,
        taskRoleArn: roles.workerTaskRole.arn,
        containerDefinitions: pulumi.jsonStringify(containerDefs),
        tags: { ...tags, Name: 'pia-worker-task' },
      });
    });

  const apiService = new aws.ecs.Service('pia-api-service', {
    name: 'pia-api',
    cluster: cluster.arn,
    taskDefinition: apiTaskDef.arn,
    desiredCount: apiDesiredCount,
    launchType: 'FARGATE',
    deploymentMaximumPercent: 200,
    deploymentMinimumHealthyPercent: 100,
    healthCheckGracePeriodSeconds: 60,
    networkConfiguration: {
      assignPublicIp: false,
      subnets: privateSubnetIds,
      securityGroups: [sg.api.id],
    },
    tags: { ...tags, Name: 'pia-api' },
  });

  const workerService = new aws.ecs.Service('pia-worker-service', {
    name: 'pia-worker',
    cluster: cluster.arn,
    taskDefinition: workerTaskDef.arn,
    desiredCount: workerDesiredCount,
    launchType: 'FARGATE',
    deploymentMaximumPercent: 200,
    deploymentMinimumHealthyPercent: 100,
    networkConfiguration: {
      assignPublicIp: false,
      subnets: privateSubnetIds,
      securityGroups: [sg.worker.id],
    },
    tags: { ...tags, Name: 'pia-worker' },
  });

  const alb = new aws.lb.LoadBalancer('pia-alb', {
    name: 'pia-alb',
    internal: false,
    loadBalancerType: 'application',
    securityGroups: [sg.alb.id],
    subnets: publicSubnetIds,
    enableDeletionProtection: true,
    tags: { ...tags, Name: 'pia-alb' },
  });

  const apiTargetGroup = new aws.lb.TargetGroup('pia-api-tg', {
    name: 'pia-api-tg',
    port: apiPort,
    protocol: 'HTTP',
    targetType: 'ip',
    vpcId,
    healthCheck: {
      enabled: true,
      path: '/health',
      protocol: 'HTTP',
      healthyThreshold: 2,
      unhealthyThreshold: 3,
      timeout: 5,
      interval: 30,
      matcher: '200-299',
    },
    tags: { ...tags, Name: 'pia-api-tg' },
  });

  const listenerArgs: aws.lb.ListenerArgs = {
    loadBalancerArn: alb.arn,
    defaultActions: [
      {
        type: 'forward',
        targetGroupArn: apiTargetGroup.arn,
      },
    ],
    tags: { ...tags, Name: 'pia-alb-listener' },
  };

  if (domainName && certificateArn) {
    listenerArgs.port = 443;
    listenerArgs.protocol = 'HTTPS';
    listenerArgs.sslPolicy = 'ELBSecurityPolicy-TLS13-1-2-2021-06';
    listenerArgs.certificateArn = certificateArn;

    new aws.lb.Listener('pia-alb-http', {
      loadBalancerArn: alb.arn,
      port: 80,
      protocol: 'HTTP',
      defaultActions: [
        {
          type: 'redirect',
          redirect: {
            protocol: 'HTTPS',
            port: '443',
            statusCode: 'HTTP_301',
          },
        },
      ],
      tags: { ...tags, Name: 'pia-alb-http-listener' },
    });
  } else {
    listenerArgs.port = 80;
    listenerArgs.protocol = 'HTTP';
  }

  const albListener = new aws.lb.Listener('pia-alb-listener', listenerArgs);

  return {
    cluster,
    apiRepository,
    workerRepository,
    apiService,
    workerService,
    alb,
    apiTargetGroup,
    albListener,
  };
}
