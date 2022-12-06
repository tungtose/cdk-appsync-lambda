import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

import { Construct } from 'constructs';

export class CdkAppsyncLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, 'cdk-ifc-user-pool', {
      userPoolName: "ifcpool",
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE
      },
      autoVerify: {
        email: true
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        }
      },
      snsRegion: 'us-west-1'
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'ifc_pool_client', {
      userPool,
    });

    const api = new appsync.CfnGraphQLApi(this, "productApi", {
      name: 'product-api',
      authenticationType: "API_KEY",
      additionalAuthenticationProviders: [{
        authenticationType: "AMAZON_COGNITO_USER_POOLS",
        userPoolConfig: {
          userPoolId: userPool.userPoolId,
          awsRegion: 'us-west-1'
        }
      }]
    })

    const graphqlSchema = new appsync.CfnGraphQLSchema(this, 'productApiSchema', {
      apiId: api.attrApiId,
      definition: `
        type Product @aws_api_key @aws_cognito_user_pools {
          id: ID!
          name: String!
          description: String!
          price: Float!
          category: String!
          sku: String
          inventory: Int
        }

        input ProductInput {
          id: ID
          name: String!
          description: String!
          price: Float!
          category: String!
          sku: String
          inventory: Int
        }

        type Query {
          getProductById(productId: ID!): Product
            @aws_api_key @aws_cognito_user_pools
          listProducts: [Product]
            @aws_api_key @aws_cognito_user_pools
        }

        type Mutation {
          createProduct(product: ProductInput!): Product
            @aws_cognito_user_pools(cognito_groups: ["Admin"])
        }

        type Subscription {
          onCreateProduct: Product
            @aws_subscribe(mutations: ["createProduct"])
        }
      `
    });

    const productLambda = new lambda.Function(this, 'ProductLambda', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'main.handler',
      code: lambda.Code.fromAsset('lambda-functions'),
      memorySize: 1024
    });


    const productTable = new ddb.Table(this, "ifc-product-table", {
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'id',
        type: ddb.AttributeType.STRING
      }
    });

    const appsyncDynamoRole = new iam.Role(this, "AppsyncDynamoDBRole", {
      assumedBy: new iam.ServicePrincipal("appsync.amazonaws.com"),
    });

    appsyncDynamoRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: ["dynamodb:*", "lambda:*", "logs:*", "cognito-idp:*"],
        effect: iam.Effect.ALLOW,
      })
    );

    const lambdaDataSource = new appsync.CfnDataSource(this, 'ProductDataSource', {
      apiId: api.attrApiId,
      name: "ProductDS",
      type: "AWS_LAMBDA",
      lambdaConfig: {
        lambdaFunctionArn: productLambda.functionArn
      },
      serviceRoleArn: appsyncDynamoRole.roleArn
    })

    const createProductResolver = new appsync.CfnResolver(this, 'createProductResolver', {
      apiId: api.attrApiId,
      typeName: "Mutation",
      fieldName: "createProduct",
      dataSourceName: lambdaDataSource.attrName,
    });

    createProductResolver.addDependsOn(graphqlSchema);

    const listProductsResolver = new appsync.CfnResolver(this, 'listProductsResolver', {
      apiId: api.attrApiId,
      typeName: "Query",
      fieldName: "listProducts",
      dataSourceName: lambdaDataSource.attrName,
    });

    listProductsResolver.addDependsOn(graphqlSchema);

    const getProductByIdResolver = new appsync.CfnResolver(this, 'getProductByIdResolver', {
      apiId: api.attrApiId,
      typeName: "Query",
      fieldName: "getProductById",
      dataSourceName: lambdaDataSource.attrName,
    });

    listProductsResolver.addDependsOn(graphqlSchema);

    productTable.addGlobalSecondaryIndex({
      indexName: "productsByCategory",
      partitionKey: {
        name: "category",
        type: ddb.AttributeType.STRING
      }
    });


    productTable.grantFullAccess(productLambda);
    productLambda.addEnvironment("PRODUCT_TABLE", productTable.tableName);

    new cdk.CfnOutput(this, "graphql_url", {
      value: api.attrGraphQlUrl
    });
  }
}
