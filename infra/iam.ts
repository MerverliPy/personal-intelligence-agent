import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { getTags } from './config';

export interface TaskRoleSet {
  apiTaskRole: aws.iam.Role;
  apiExecutionRole: aws.iam.Role;
  workerTaskRole: aws.iam.Role;
  workerExecutionRole: aws.iam.Role;
}

export function createIamRoles(): TaskRoleSet {
  const tags = getTags();

  const assumeRolePolicy = aws.iam.assumeRolePolicyForPrincipal({
    Service: 'ecs-tasks.amazonaws.com',
  });

  const apiTaskRole = new aws.iam.Role('pia-api-task-role', {
    assumeRolePolicy,
    description: 'Task role for PIA API service',
    tags: { ...tags, Name: 'pia-api-task-role' },
  });

  const apiExecutionRole = new aws.iam.Role('pia-api-exec-role', {
    assumeRolePolicy,
    description: 'Execution role for PIA API service',
    managedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'],
    tags: { ...tags, Name: 'pia-api-exec-role' },
  });

  const workerTaskRole = new aws.iam.Role('pia-worker-task-role', {
    assumeRolePolicy,
    description: 'Task role for PIA Worker service',
    tags: { ...tags, Name: 'pia-worker-task-role' },
  });

  const workerExecutionRole = new aws.iam.Role('pia-worker-exec-role', {
    assumeRolePolicy,
    description: 'Execution role for PIA Worker service',
    managedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'],
    tags: { ...tags, Name: 'pia-worker-exec-role' },
  });

  const s3Policy = new aws.iam.Policy('pia-s3-access', {
    description: 'Allow access to PIA storage bucket',
    policy: pulumi.output({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
          Resource: [
            pulumi.interpolate`arn:aws:s3:::pia-storage-${pulumi.getStack()}`,
            pulumi.interpolate`arn:aws:s3:::pia-storage-${pulumi.getStack()}/*`,
          ],
        },
      ],
    }),
  });

  const secretsPolicy = new aws.iam.Policy('pia-secrets-read', {
    description: 'Allow reading PIA secrets',
    policy: pulumi.output({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['secretsmanager:GetSecretValue'],
          Resource: [`arn:aws:secretsmanager:*:*:secret:pia/*`],
        },
      ],
    }),
  });

  for (const role of [apiTaskRole, workerTaskRole]) {
    new aws.iam.RolePolicyAttachment(`pia-${role.name}-s3`, {
      role: role.name,
      policyArn: s3Policy.arn,
    });
    new aws.iam.RolePolicyAttachment(`pia-${role.name}-secrets`, {
      role: role.name,
      policyArn: secretsPolicy.arn,
    });
  }

  return { apiTaskRole, apiExecutionRole, workerTaskRole, workerExecutionRole };
}
