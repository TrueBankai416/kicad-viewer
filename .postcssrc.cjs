// SPDX-FileCopyrightText: Nextcloud contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// keep json compatible key naming (double quotes) and comma trailing

module.exports = (ctx) => ({
  plugins: [
    require('autoprefixer')({
      // browsers: [], // defined in .browserslistrc file!
      cascade: true,
      add: true,
      remove: false,
      supports: true,
      flexbox: true,
      grid: false,
      ignoreUnknownVersions: false,
    }),
    // TODO: move cssnano stage from Postcss to optimize-css-assets-webpack-plugin
    ctx.env === 'development'
      ? null
      : require('cssnano')({
        // https://cssnano.co/docs/optimisations
        preset: ['default', {
          autoprefixer: false, // do not remove prefixes
          discardComments: {
            removeAll: true,
          },
          normalizeUrl: false,
          normalizeWhitespace: true,
          zindex: false,
        }],
      }),
  ].filter((e) => e !== null),
});
