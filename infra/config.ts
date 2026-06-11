import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

const stackConfig = new pulumi.Config();

export interface PiaConfig {
  vpcCidr: string;
  azCount: number;
  databaseName: string;
  databaseUser: string;
  redisNodeType: string;
  apiCpu: string;
  apiMemory: string;
  apiDesiredCount: number;
  apiPort: number;
  workerCpu: string;
  workerMemory: string;
  workerDesiredCount: number;
  domainName: string;
  certificateArn: string;
}

export function getConfig(): PiaConfig {
  return {
    vpcCidr: stackConfig.require('vpcCidr'),
    azCount: Number(stackConfig.require('azCount')),
    databaseName: stackConfig.require('databaseName'),
    databaseUser: stackConfig.require('databaseUser'),
    redisNodeType: stackConfig.require('redisNodeType'),
    apiCpu: stackConfig.require('apiCpu'),
    apiMemory: stackConfig.require('apiMemory'),
    apiDesiredCount: Number(stackConfig.require('apiDesiredCount')),
    apiPort: Number(stackConfig.require('apiPort')),
    workerCpu: stackConfig.require('workerCpu'),
    workerMemory: stackConfig.require('workerMemory'),
    workerDesiredCount: Number(stackConfig.require('workerDesiredCount')),
    domainName: stackConfig.get('domainName') ?? '',
    certificateArn: stackConfig.get('certificateArn') ?? '',
  };
}

export function getTags(): Record<string, string> {
  return {
    Project: 'pia',
    Environment: pulumi.getStack(),
    ManagedBy: 'pulumi',
  };
}
