import * as React from 'preact';
import {App} from '../foremark/app/view/app';
import {setWorkingDom} from '../foremark/app/utils/dom';
import {DEFAULT_VIEWER_CONFIG, mergeObjects} from '../foremark/app/view/config';
import {expandSitemap, SitemapEntry} from '../foremark/app/view/sitemap';

const dom = process.env.FOREMARK_STRIP_SSR ? null : (() => {
    const JSDOM: typeof import('jsdom').JSDOM = require('jsdom').JSDOM;

    const dom = new JSDOM('<html xmlns="http://www.w3.org/1999/xhtml" />', {
        contentType: 'application/xhtml+xml',
    });

    if (typeof document === 'undefined') {
        setWorkingDom(dom.window);
    }

    return dom;
})();

// Monkeypatch - GatsbyJS defaults to React but Foremark expects Preact.
if (!React.h) {
    (React as any).h = (React as any).createElement;
}

/**
 * Configuration for `AppLayout`.
 *
 * Note: The fields are not public and subject to change in the future.
 */
export interface AppConfig {
    sitemap: {
        rootEntries: ReadonlyArray<SitemapEntry>;
        documentRoot: string;
    } | null;
}

/**
 * Construct an `AppConfig` from a viewer configuration `config`.
 *
 * `config` can be either a complete configuration object (`ViewerConfig`) or
 * an array of unmerged configuration objects.
 *
 * If a sitemap (`ViewerConfig.sitemap`) is specified, the root path
 * (`sitemapDocumentRoot`) must be specified explicitly.
 */
export function loadAppConfigFromViewerConfig(configObjects: object | object[]): AppConfig {
    // Merge config objects
    let config = DEFAULT_VIEWER_CONFIG;

    if (configObjects instanceof Array) {
        for (const userConfig of configObjects) {
            config = mergeObjects(config, userConfig);
        }
    } else {
        config = configObjects as any;
    }

    const sitemapErrors: string[] = [];
    const rootEntries = config.sitemap &&
        expandSitemap(config.sitemap, sitemapErrors, dom ? dom.window.document : document);

    if (sitemapErrors.length > 0) {
        throw new Error("Failed to process sitemap: " + sitemapErrors.join('\n'));
    }

    let sitemap;
    if (rootEntries) {
        if (config.sitemapDocumentRoot == null) {
            throw new Error("sitemapDocumentRoot must be specified when sitemap is set");
        }

        let documentRoot = config.sitemapDocumentRoot;
        if (documentRoot.endsWith('/')) {
            documentRoot = documentRoot.substr(0, documentRoot.length - 1);
        }

        sitemap = {rootEntries, documentRoot};
    } else {
        sitemap = null;
    }

    return {sitemap};
}

/**
 * Replace paths of sitemap entries using the specified function.
 */
export function appConfigRemapSitemapPaths(config: AppConfig, fn: (paths: string[]) => string[]): void {
    if (config.sitemap) {
        forEachEntry(config.sitemap.rootEntries, e => {
            e.paths = fn(e.paths);
        });
    }
}

const DEFAULT_CONFIG = loadAppConfigFromViewerConfig([]);

// Import stylesheets. Of all page content stylesheets, only `katex.less` seems
// to be not indirectly referenced by modules we use.
require('../foremark/lib/katex.less');

export interface AppLayoutProps {
    html: string;
    config?: AppConfig;

    /**
     * The document path used to find a sitemap entry that matches the current
     * page. Must be specified if a sitemap is enabled. The page must be
     * included in the sitemap.
     */
    path?: string;
}

interface AppLayoutState {}

export class AppLayout extends React.Component<AppLayoutProps, AppLayoutState> {
    private readonly renderPromise: Promise<void>;
    private renderDone?: () => void;
    private foremarkDocument: any;
    private currentSitemapEntry: SitemapEntry | null = null;

    constructor(props: AppLayoutProps) {
        super(props);
        this.state = {};

        this.renderPromise = new Promise(resolve => {
            this.renderDone = resolve;
        });

        this.updateForemarkDocument();
        this.updateCurrentSitemapEntry();
    }

    componentDidMount(): void {
        this.renderDone!();
    }

    private updateForemarkDocument(): void {
        if (typeof document === 'undefined') {
            if (!dom) {
                // We're server-side rendering, but server-side rendering is
                // disabled
                throw new Error();
            }

            const e = dom.window.document.createElement('div');
            e.innerHTML = this.props.html;

            this.foremarkDocument = e;
        } else {
            const doc = this.foremarkDocument = document.createElement('div');
            doc.innerHTML = this.props.html;
        }
    }

    componentDidUpdate(prevProps: AppLayoutProps, prevState: AppLayoutState): void {
        if (prevProps.config !== this.props.config || prevProps.path !== this.props.path) {
            this.updateCurrentSitemapEntry();
        }
    }

    private get config(): AppConfig {
        return this.props.config || DEFAULT_CONFIG;
    }

    private updateCurrentSitemapEntry(): void {
        const {config} = this;

        if (config.sitemap) {
            if (this.props.path == null) {
                throw new Error("path is required when a sitemap is set.");
            }

            const {sitemap} = config;
            const docPath = this.props.path.toLowerCase();

            let currentEntry: SitemapEntry | null = null;

            forEachEntry(sitemap.rootEntries, e => {
                for (const path of e.paths) {
                    if (docPath === sitemap.documentRoot + path.toLowerCase()) {
                        currentEntry = e;
                    }
                }
            });

            if (!currentEntry) {
                throw new Error(`path '${this.props.path}' is not in the sitemap`);
            }

            this.currentSitemapEntry = currentEntry;
        } else {
            this.currentSitemapEntry = null;
        }
    }

    render() {
        const {config} = this;

        let sitemap;
        if (config.sitemap) {
            sitemap = {
                rootEntries: config.sitemap.rootEntries,
                currentEntry: this.currentSitemapEntry!,
                documentRoot: config.sitemap.documentRoot,
            };
        } else {
            sitemap = null;
        }

        return <App
            sitemap={sitemap}
            renderPromise={this.renderPromise}
            foremarkDocument={this.foremarkDocument}
            injectDocumentAsHtml={typeof document === 'undefined'}
            hideSpinner={true} />;
    }
}

function forEachEntry(list: ReadonlyArray<SitemapEntry>, cb: (e: SitemapEntry) => void): void {
    for (const e of list) {
        cb(e);
        forEachEntry(e.children, cb);
    }
}
