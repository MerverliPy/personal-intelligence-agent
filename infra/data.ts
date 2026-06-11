import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { SecurityGroupSet } from './security';
import { getTags } from './config';

export interface DatabaseResources {
  subnetGroup: aws.rds.SubnetGroup;
  instance: aws.rds.Instance;
  connectionUrl: pulumi.Output<string>;
}

export function createDatabase(
  name: string,
  username: string,
  privateSubnetIds: pulumi.Output<string>[],
  dbSecurityGroupId: pulumi.Output<string>,
): DatabaseResources {
  const tags = getTags();

  const password = new aws.secretsmanager.Secret('pia-db-password', {
    namePrefix: 'pia/db-password/',
    description: 'PostgreSQL master password for PIA',
    tags,
  });

  const passwordVersion = new aws.secretsmanager.SecretVersion('pia-db-password-version', {
    secretId: password.id,
    secretString: pulumi.interpolate`{"password":"${password.id}"}`,
  });

  const dbPassword = aws.secretsmanager
    .getSecretVersion({
      secretId: password.id,
    })
    .then((v) => JSON.parse(v.secretString).password ?? '');

  const subnetGroup = new aws.rds.SubnetGroup('pia-db-subnet', {
    subnetIds: privateSubnetIds,
    description: 'Subnet group for PIA RDS instance',
    tags: { ...tags, Name: 'pia-db-subnet' },
  });

  const instance = new aws.rds.Instance('pia-db', {
    engine: 'postgres',
    engineVersion: '17.4',
    instanceClass: 'db.t4g.micro',
    dbName: name,
    username,
    password: dbPassword,
    port: 5432,
    allocatedStorage: 20,
    maxAllocatedStorage: 100,
    storageEncrypted: true,
    storageType: 'gp3',
    multiAz: false,
    publiclyAccessible: false,
    skipFinalSnapshot: false,
    finalSnapshotIdentifier: pulumi.interpolate`pia-db-final-${pulumi.getStack()}`,
    backupRetentionPeriod: 14,
    backupWindow: '03:00-04:00',
    maintenanceWindow: 'sun:04:00-sun:05:00',
    autoMinorVersionUpgrade: true,
    deletionProtection: true,
    dbSubnetGroupName: subnetGroup.name,
    vpcSecurityGroupIds: [dbSecurityGroupId],
    tags: { ...tags, Name: 'pia-db' },
  });

  const connectionUrl = pulumi.interpolate`postgresql://${username}:${password.id}@${instance.endpoint}/${name}?sslmode=require`;

  return { subnetGroup, instance, connectionUrl };
}

export function createRedis(
  nodeType: string,
  privateSubnetIds: pulumi.Output<string>[],
  redisSecurityGroupId: pulumi.Output<string>,
): aws.elasticache.Cluster {
  const tags = getTags();

  const subnetGroup = new aws.elasticache.SubnetGroup('pia-redis-subnet', {
    subnetIds: privateSubnetIds,
    description: 'Subnet group for PIA Redis',
    tags: { ...tags, Name: 'pia-redis-subnet' },
  });

  return new aws.elasticache.Cluster('pia-redis', {
    engine: 'redis',
    engineVersion: '7.1',
    nodeType,
    numCacheNodes: 1,
    port: 6379,
    subnetGroupName: subnetGroup.name,
    securityGroupIds: [redisSecurityGroupId],
    parameterGroupName: 'default.redis7',
    atRestEncryptionEnabled: true,
    transitEncryptionEnabled: true,
    tags: { ...tags, Name: 'pia-redis' },
  });
}

export function createStorageBucket(): aws.s3.BucketV2 {
  const tags = getTags();

  const bucket = new aws.s3.BucketV2('pia-storage', {
    bucket: pulumi.interpolate`pia-storage-${pulumi.getStack()}`,
    forceDestroy: false,
    tags: { ...tags, Name: 'pia-storage' },
  });

  new aws.s3.BucketServerSideEncryptionConfigurationV2('pia-storage-encryption', {
    bucket: bucket.id,
    rules: [
      {
        applyServerSideEncryptionByDefault: {
          sseAlgorithm: 'AES256',
        },
      },
    ],
  });

  new aws.s3.BucketVersioningV2('pia-storage-versioning', {
    bucket: bucket.id,
    versioningConfiguration: {
      status: 'Enabled',
    },
  });

  new aws.s3.BucketPublicAccessBlock('pia-storage-public-block', {
    bucket: bucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  });

  new aws.s3.BucketLifecycleConfigurationV2('pia-storage-lifecycle', {
    bucket: bucket.id,
    rules: [
      {
        id: 'expire-old-versions',
        status: 'Enabled',
        noncurrentVersionExpiration: {
          noncurrentDays: 90,
        },
      },
    ],
  });

  return bucket;
}
