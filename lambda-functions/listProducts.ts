import * as AWS from 'aws-sdk';
const docClient = new AWS.DynamoDB.DocumentClient()

async function listProducts() {
  const params = {
    TableName: process.env.PRODUCT_TABLE!,
  }
  try {
    const data = await docClient.scan(params).promise()
    return data.Items
  } catch (err) {
    console.log('List Product error: ', err)
    return null;
  }
}

export default listProducts
