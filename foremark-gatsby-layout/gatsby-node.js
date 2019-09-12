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
          'FOREMARK_STRIP_SSR': JSON.stringify(
            stage === 'build-javascript' || stage === 'develop'
           ),
        },
      })
    ],
  });

  if (stage === 'build-html') {
    let canvasInstalled = false;
    try {
      require.resolve("canvas");
      canvasInstalled = true;
    } catch (e) {
      // canvas is not installed
    }

    if (!canvasInstalled) {
      // `jsdom`'s detection algorithm for `canvas` has issues with webpack.
      // Specifically, it relies on whether `require.resolve` fails or not to
      // detect the availability of `canvas`, but webpack's static analysis cannot
      // handle this pattern and raises a module resolution error.
      actions.setWebpackConfig({
        resolve: {
          alias: {
            // Map it to whatever valid module
            canvas: require.resolve('./index'),
          },
        },
      });
    }
  }
};
