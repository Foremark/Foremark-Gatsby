# [GatsbyJS] plugins for [Foremark]

[GatsbyJS]: https://www.gatsbyjs.org
[Foremark]: https://foremark.github.io

## `foremark-gatsby-layout`

Provides a component simulating the user interface of Foremark's viewer application.

Requires `gatsby-plugin-less` with `strictMath` and `strictUnits` options:

```javascript
// in gatsby-config.js
plugins: [
  {
    resolve: `gatsby-plugin-less`,
    options: {
      strictMath: true,
      strictUnits: true,
    },
  },
]
```

## `foremark-gatsby-transformer`

## TODO

- The ESLint rule `no-unused-expressions` fails for compiled code. Currently, a GatsbyJS project's `.eslintrc.json` should be updated with the following content: `{ "rules": { "no-unused-expressions": "off" } }`
- Make a starter project
- Find a better way to convert between Preact and React
