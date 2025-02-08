# symbol-api-node-selector

Avoid (as much as possible) nodes that are resynchronizing, and randomly select one node from the statistics service that has a fast response.

## Usag

```typescript
import { getRestUrl } from 'symbol-api-node-selector'

const node = await getRestUrl('testnet')
console.log(`Selected node: ${node}`)
```
