import * as pulumi from '@pulumi/pulumi';
import { getConfig } from './config';
import { createNetwork } from './network';
import { createSecurityGroups } from './security';
import { createDatabase, createRedis, createStorageBucket } from './data';
import { createIamRoles } from './iam';
import { createCompute } from './compute';

function main() {
  const cfg = getConfig();

  const network = createNetwork(cfg.vpcCidr, cfg.azCount);

  const privateSubnetIds = network.privateSubnets.map((s) => s.id);
  const publicSubnetIds = network.publicSubnets.map((s) => s.id);

  const sg = createSecurityGroups(network.vpc.id, cfg.apiPort);

  const db = createDatabase(cfg.databaseName, cfg.databaseUser, privateSubnetIds, sg.database.id);

  const redis = createRedis(cfg.redisNodeType, privateSubnetIds, sg.redis.id);

  const storageBucket = createStorageBucket();

  const roles = createIamRoles();

  const redisEndpoint = redis.cacheNodes.apply(
    (nodes) => `rediss://${nodes[0].address}:${nodes[0].port}`,
  );

  const compute = createCompute(
    privateSubnetIds,
    publicSubnetIds,
    sg,
    roles,
    network.vpc.id,
    cfg.apiPort,
    cfg.apiCpu,
    cfg.apiMemory,
    cfg.apiDesiredCount,
    cfg.workerCpu,
    cfg.workerMemory,
    cfg.workerDesiredCount,
    cfg.domainName,
    cfg.certificateArn,
    db.connectionUrl,
    redisEndpoint,
    storageBucket.id,
  );

  return {
    vpcId: network.vpc.id,
    databaseEndpoint: db.instance.endpoint,
    redisEndpoint,
    storageBucketName: storageBucket.id,
    apiEcrRepo: compute.apiRepository.repositoryUrl,
    workerEcrRepo: compute.workerRepository.repositoryUrl,
    albDnsName: compute.alb.dnsName,
    apiTargetGroupArn: compute.apiTargetGroup.arn,
  };
}

export const outputs = main();
