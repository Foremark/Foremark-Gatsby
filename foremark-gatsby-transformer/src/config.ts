import {MediaHandler, BUILTIN_MEDIA_HANDLERS} from './media';

export interface ViewerConfig {
    /**
     * Defines a set of media handlers.
     *
     * Media handlers work similarly to the vanilla Foremark.
     */
    mediaHandlers: { [key: string]: MediaHandler | null; };

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
    mediaHandlers: BUILTIN_MEDIA_HANDLERS,
    headingNumbers: false,
};
