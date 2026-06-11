import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { getTags } from './config';

export interface SecurityGroupSet {
  alb: aws.ec2.SecurityGroup;
  api: aws.ec2.SecurityGroup;
  worker: aws.ec2.SecurityGroup;
  database: aws.ec2.SecurityGroup;
  redis: aws.ec2.SecurityGroup;
}

export function createSecurityGroups(
  vpcId: pulumi.Output<string>,
  apiPort: number,
): SecurityGroupSet {
  const tags = getTags();

  const alb = new aws.ec2.SecurityGroup('pia-alb-sg', {
    vpcId,
    description: 'ALB security group',
    ingress: [
      {
        protocol: 'tcp',
        fromPort: 443,
        toPort: 443,
        cidrBlocks: ['0.0.0.0/0'],
        description: 'HTTPS from internet',
      },
      {
        protocol: 'tcp',
        fromPort: 80,
        toPort: 80,
        cidrBlocks: ['0.0.0.0/0'],
        description: 'HTTP redirect to HTTPS',
      },
    ],
    egress: [
      {
        protocol: '-1',
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ['0.0.0.0/0'],
        description: 'All outbound',
      },
    ],
    tags: { ...tags, Name: 'pia-alb-sg' },
  });

  const api = new aws.ec2.SecurityGroup('pia-api-sg', {
    vpcId,
    description: 'API service security group',
    ingress: [
      {
        protocol: 'tcp',
        fromPort: apiPort,
        toPort: apiPort,
        securityGroups: [alb.id],
        description: 'API from ALB',
      },
    ],
    egress: [
      {
        protocol: '-1',
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ['0.0.0.0/0'],
        description: 'All outbound',
      },
    ],
    tags: { ...tags, Name: 'pia-api-sg' },
  });

  const worker = new aws.ec2.SecurityGroup('pia-worker-sg', {
    vpcId,
    description: 'Worker service security group',
    egress: [
      {
        protocol: '-1',
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ['0.0.0.0/0'],
        description: 'All outbound',
      },
    ],
    tags: { ...tags, Name: 'pia-worker-sg' },
  });

  const database = new aws.ec2.SecurityGroup('pia-db-sg', {
    vpcId,
    description: 'Database security group',
    ingress: [
      {
        protocol: 'tcp',
        fromPort: 5432,
        toPort: 5432,
        securityGroups: [api.id, worker.id],
        description: 'PostgreSQL from API and Worker',
      },
    ],
    tags: { ...tags, Name: 'pia-db-sg' },
  });

  const redis = new aws.ec2.SecurityGroup('pia-redis-sg', {
    vpcId,
    description: 'Redis security group',
    ingress: [
      {
        protocol: 'tcp',
        fromPort: 6379,
        toPort: 6379,
        securityGroups: [api.id, worker.id],
        description: 'Redis from API and Worker',
      },
    ],
    tags: { ...tags, Name: 'pia-redis-sg' },
  });

  return { alb, api, worker, database, redis };
}
