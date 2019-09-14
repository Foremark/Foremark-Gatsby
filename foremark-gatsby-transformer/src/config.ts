export interface ViewerConfig {
    // TODO: `mediaHandlers`

    // No `sitemap` here - It's up to `foremark-gatsby-layout`

    /**
     * Enables or disables automatic heading numbering.
     *
     * Defaults to `false`. Set this to `true` to enable automatic heading
     * numbering.
     */
    headingNumbers: boolean;
}

/**
 * The default configuration object.
 */
export const DEFAULT_VIEWER_CONFIG: ViewerConfig = {
    headingNumbers: false,
};
