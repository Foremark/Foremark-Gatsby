exports.onCreateWebpackConfig = ({ stage, actions, plugins }) => {
  // map `preact` to `react` that GatsbyJS uses
  actions.setWebpackConfig({
    resolve: {
      alias: {
        preact: `react`,
      },
    },
    plugins: [
      plugins.define({
        'process.env': {
          'VERSION': JSON.stringify(require('./foremark/package.json').version + ' (GatsbyJS port)'),
          'URL': JSON.stringify(require('./foremark/package.json').homepage),
          'COMMITHASH': JSON.stringify('?'),
          'BRANCH': JSON.stringify('?'),
          'LAZY_LOADING': JSON.stringify(false),
        },
      })
    ],
  });
};
