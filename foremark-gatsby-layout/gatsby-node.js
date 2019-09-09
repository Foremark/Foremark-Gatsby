exports.onCreateWebpackConfig = ({ stage, actions }) => {
  // map `preact` to `react` that GatsbyJS uses
  actions.setWebpackConfig({
    resolve: {
      alias: {
        preact: `react`,
      },
    },
  });
};
