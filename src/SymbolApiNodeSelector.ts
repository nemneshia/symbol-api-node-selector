import axios from 'axios'
import createClient from 'openapi-fetch'
import { paths } from './schema.js'

const MAINNET_SSS_URL = 'https://symbol.services'
const TESTNET_SSS_URL = 'https://testnet.symbol.services'

export async function getRestUrl(
  networkType: 'mainnet' | 'testnet' | string = 'mainnet',
  isSsl = true,
) {
  const restUrls = await getStatisticsService(networkType, isSsl)
  const restUrl = await getFastestUrl(restUrls)
  return restUrl
}

async function getStatisticsService(networkType: string, isSsl: boolean) {
  const limit = 10

  const client = createClient<paths>({
    baseUrl: networkType === 'mainnet' ? MAINNET_SSS_URL : TESTNET_SSS_URL,
  })
  const { data, response } = await client.GET('/nodes', {
    params: { query: { order: 'random', ssl: isSsl, limit: limit } },
  })

  if (response.status !== 200) throw new Error('Failed to access /nodes')
  if (!data || data.length === 0) throw new Error('Empty response for /nodes')

  const apiNodes = data.filter((val) => (val.roles & 2) === 2)

  const restUrls: string[] = []
  for (const node of apiNodes) {
    if (node.apiStatus) {
      restUrls.push(node.apiStatus.restGatewayUrl)
    }
  }

  return restUrls
}

async function getFastestUrl(urls: string[]): Promise<string> {
  const requests = urls.map(
    (url) =>
      new Promise<{ url: string; height: number }>((resolve) => {
        axios
          .get(`${url}/chain/info`, { timeout: 3000 })
          .then((response) => {
            resolve({ url, height: response.data.height })
          })
          .catch(() => resolve({ url: '', height: 0 }))
      }),
  )

  const results = await Promise.all(requests)
  const validResults = results.filter((result) => result.url !== '')

  if (validResults.length === 0) throw new Error('No valid nodes found')

  validResults.sort((a, b) => a.height - b.height)
  const medianIndex = Math.floor(validResults.length / 2)
  const start = Math.max(0, medianIndex - 5)
  const end = Math.min(validResults.length, medianIndex + 5)
  const medianRange = validResults.slice(start, end)

  const fastestNode = await Promise.race(
    medianRange.map(
      (node) =>
        new Promise<string>((resolve) => {
          axios
            .get(`${node.url}/node/info`, { timeout: 3000 })
            .then(() => resolve(node.url))
            .catch(() => resolve(''))
        }),
    ),
  )

  if (!fastestNode) throw new Error('No fastest node found in the median range')

  return fastestNode
}
