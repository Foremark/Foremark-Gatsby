import * as React from 'preact';
import {App} from '../foremark/app/view/app';
import {setWorkingDom} from '../foremark/app/utils/dom';

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

export interface AppLayoutProps {
    html: string;
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
        // TODO
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

        return <App
            sitemap={null}
            renderPromise={this.renderPromise}
            foremarkDocument={this.foremarkDocument}
            hideSpinner={true} />;
    }
}
