import * as React from 'preact';
import {App} from '../foremark/app/view/app';

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
            this.foremarkDocument = { querySelectorAll() { return []; } };
        } else {
            const doc = this.foremarkDocument = document.createElement('div');
            doc.innerHTML = this.props.html;
        }
    }

    render() {

        return <App
            sitemap={null}
            renderPromise={this.renderPromise}
            foremarkDocument={this.foremarkDocument} />;
    }
}
