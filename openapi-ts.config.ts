import { defineConfig, UserConfig } from '@hey-api/openapi-ts'

const config: Promise<UserConfig> = defineConfig({
  input: 'http://localhost:3006/json',
  output: './src/client',
  plugins: [
    {
      name: '@hey-api/client-fetch',
      baseUrl: 'http://localhost:3006',
      throwOnError: true,
    },
    {
      name: '@hey-api/sdk',
      // NOTE: this doesn't allow tree-shaking
      asClass: true,
      operationId: true,
      classNameBuilder: '{{name}}Service',
      methodNameBuilder: (operation) => {
        // @ts-expect-error
        const operationId = operation.operationId ?? ''
        const separatorIndex = operationId.lastIndexOf('-')
        const name =
          separatorIndex === -1
            ? operationId
            : operationId.slice(separatorIndex + 1)

        return name
          .split(/[_\s-]+/)
          .filter(Boolean)
          .map((part: any, index: number) =>
            index === 0
              ? part.charAt(0).toLowerCase() + part.slice(1)
              : part.charAt(0).toUpperCase() + part.slice(1),
          )
          .join('')
      },
    },
    {
      name: '@hey-api/schemas',
      type: 'json',
    },
  ],
})

export default config
