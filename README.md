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

TODO

Requires `gatsby-plugin-sharp`.

## `foremark-config-loader`

This package implements a webpack loader for importing Foremark viewer configuration files.

## TODO

- Make a starter project
- Find a better way to convert between Preact and React
- Per-page viewer config
- Custom media handlers
- Audio/video media handlers
- Reduce the usage of Foremark's private API such as `expandSitemap` and `mergeObjects`
- Fix for HTML, e.g., move elements to a valid place
