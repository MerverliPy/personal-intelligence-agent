import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { getTags } from './config';

export interface NetworkResources {
  vpc: aws.ec2.Vpc;
  publicSubnets: aws.ec2.Subnet[];
  privateSubnets: aws.ec2.Subnet[];
  internetGateway: aws.ec2.InternetGateway;
  natGateway: aws.ec2.NatGateway;
  natEip: aws.ec2.Eip;
  publicRouteTable: aws.ec2.RouteTable;
  privateRouteTables: aws.ec2.RouteTable[];
}

export function createNetwork(vpcCidr: string, azCount: number): NetworkResources {
  const tags = getTags();

  const availableZones = aws
    .getAvailabilityZones({ state: 'available' })
    .then((z) => z.names.slice(0, azCount));

  const vpc = new aws.ec2.Vpc('pia-vpc', {
    cidrBlock: vpcCidr,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: { ...tags, Name: 'pia-vpc' },
  });

  const publicSubnets: aws.ec2.Subnet[] = [];
  const privateSubnets: aws.ec2.Subnet[] = [];

  for (let i = 0; i < azCount; i++) {
    const publicSubnet = new aws.ec2.Subnet(`pia-public-${i}`, {
      vpcId: vpc.id,
      cidrBlock: pulumi.interpolate`10.0.${i}.0/24`,
      availabilityZone: availableZones.then((z) => z[i]),
      mapPublicIpOnLaunch: true,
      tags: { ...tags, Name: `pia-public-${i}` },
    });
    publicSubnets.push(publicSubnet);

    const privateSubnet = new aws.ec2.Subnet(`pia-private-${i}`, {
      vpcId: vpc.id,
      cidrBlock: pulumi.interpolate`10.0.${i + azCount}.0/24`,
      availabilityZone: availableZones.then((z) => z[i]),
      mapPublicIpOnLaunch: false,
      tags: { ...tags, Name: `pia-private-${i}` },
    });
    privateSubnets.push(privateSubnet);
  }

  const internetGateway = new aws.ec2.InternetGateway('pia-igw', {
    vpcId: vpc.id,
    tags: { ...tags, Name: 'pia-igw' },
  });

  const natEip = new aws.ec2.Eip('pia-nat-eip', {
    domain: 'vpc',
    tags: { ...tags, Name: 'pia-nat-eip' },
  });

  const natGateway = new aws.ec2.NatGateway(
    'pia-nat',
    {
      allocationId: natEip.id,
      subnetId: publicSubnets[0].id,
      tags: { ...tags, Name: 'pia-nat' },
    },
    { dependsOn: [internetGateway] },
  );

  const publicRouteTable = new aws.ec2.RouteTable('pia-public-rt', {
    vpcId: vpc.id,
    routes: [{ cidrBlock: '0.0.0.0/0', gatewayId: internetGateway.id }],
    tags: { ...tags, Name: 'pia-public-rt' },
  });

  const privateRouteTables: aws.ec2.RouteTable[] = [];

  for (let i = 0; i < azCount; i++) {
    new aws.ec2.RouteTableAssociation(`pia-public-rta-${i}`, {
      subnetId: publicSubnets[i].id,
      routeTableId: publicRouteTable.id,
    });

    const privateRt = new aws.ec2.RouteTable(`pia-private-rt-${i}`, {
      vpcId: vpc.id,
      routes: [{ cidrBlock: '0.0.0.0/0', natGatewayId: natGateway.id }],
      tags: { ...tags, Name: `pia-private-rt-${i}` },
    });
    privateRouteTables.push(privateRt);

    new aws.ec2.RouteTableAssociation(`pia-private-rta-${i}`, {
      subnetId: privateSubnets[i].id,
      routeTableId: privateRt.id,
    });
  }

  return {
    vpc,
    publicSubnets,
    privateSubnets,
    internetGateway,
    natGateway,
    natEip,
    publicRouteTable,
    privateRouteTables,
  };
}
