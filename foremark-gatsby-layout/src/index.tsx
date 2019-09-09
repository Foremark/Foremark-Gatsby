import * as React from 'preact';
import {App} from '../foremark/app/view/app';

export interface AppLayoutProps {
    html: string;
}

interface AppLayoutState {}

export class AppLayout extends React.Component<AppLayoutProps, AppLayoutState> {
    private readonly renderPromise: Promise<void>;
    private renderDone?: () => void;

    constructor(props: AppLayoutProps) {
        super(props);
        this.state = {};

        this.renderPromise = new Promise(resolve => {
            this.renderDone = resolve;
        });
    }

    componentDidMount(): void {
        this.renderDone!();
    }

    render() {
        const foremarkDocument: any = null; // TODO
        return <App
            sitemap={null}
            renderPromise={this.renderPromise}
            foremarkDocument={foremarkDocument} />;
    }
}
