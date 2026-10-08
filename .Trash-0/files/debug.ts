import { toHtml } from '../src/utils/exporter/toHtml'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'

async function main() {
  const codeHtml = await toHtml('```js\nconst x = 1\n```')
  console.log('=== CODE HTML ===')
  console.log(codeHtml)

  const md =
    '| Col A | Col B |\n| --- | --- |\n| Apple | 10 |\n| Banana | 20 |'
  console.log('=== TABLE MDAST ===')
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md)
  console.log(JSON.stringify(tree, null, 2))
}

main()
