import * as React from 'preact';
import {App} from '../foremark/app/view/app';
import {setWorkingDom} from '../foremark/app/utils/dom';
import {DEFAULT_VIEWER_CONFIG, mergeObjects} from '../foremark/app/view/config';
import {processSitemap, Sitemap} from '../foremark/app/view/sitemap';

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

/** Configuration for `AppLayout`. */
export interface AppConfig {
    sitemap: Sitemap | null;
}

/**
 * Construct an `AppConfig` from a viewer configuration `config`.
 *
 * `config` can be either a complete configuration object (`ViewerConfig`) or
 * an array of unmerged configuration objects.
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

    const [sitemap, sitemapErrors] = processSitemap(config.sitemap, config.sitemapDocumentRoot);

    if (sitemapErrors.length > 0) {
        throw new Error("Failed to process sitemap: " + sitemapErrors.join('\n'));
    }

    return {sitemap};
}

const DEFAULT_CONFIG = loadAppConfigFromViewerConfig([]);

export interface AppLayoutProps {
    html: string;
    config?: AppConfig;
}

interface AppLayoutState {}

export class AppLayout extends React.Component<AppLayoutProps, AppLayoutState> {
    private readonly renderPromise: Promise<void>;
    private renderDone?: () => void;
    private foremarkDocument: any;

    constructor(props: AppLayoutProps) {
        super(props);
        this.state = {};

        this.renderPromise = new Promise(resolve => {
            this.renderDone = resolve;
        });

        this.updateForemarkDocument();
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

    render() {
        const config = this.props.config || DEFAULT_CONFIG;

        return <App
            sitemap={config.sitemap}
            renderPromise={this.renderPromise}
            foremarkDocument={this.foremarkDocument}
            injectDocumentAsHtml={typeof document === 'undefined'}
            hideSpinner={true} />;
    }
}
