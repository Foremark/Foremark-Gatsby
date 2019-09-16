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

### Tips

- **TOC navigation without JavaScript**: This component is mostly usable even without client-side JavaScript enabled. However, in this case, sitemap (global TOC) entries cannot be expanded by clicking the expand button. Usually, visitors can just click the TOC entry's link, which automatically reveals its children. However, if the entry does not have any pages attached, this won't work because the link is unclickable, thus making it impossible to navigate child pages. Therefore, it's recommended to attach a page to every sitemap entry.

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
