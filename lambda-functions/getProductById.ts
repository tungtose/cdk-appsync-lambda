import * as AWS from 'aws-sdk';

const docClient = new AWS.DynamoDB.DocumentClient();

async function getProductById(productId: string) {
  const params = {
    TableName: process.env.PRODUCT_TABLE!,
    Key: { id: productId }
  }

  try {
    const data = await docClient.get(params).promise();
    return data.Item;
  } catch (error) {
    console.log("Get Product error:", error);
    return null;
  }
}

export default getProductById;
