import {JSDOM} from 'jsdom';
import * as Foremark from 'foremark';
import {TagNames} from 'foremark/dist/foremark';

import {prepareForemarkForViewing, ViewTagNames} from './mfview';
import {DEFAULT_VIEWER_CONFIG} from './config';
import {MediaHandlerContext} from './media';

export interface StaticForemark {
    html: string;
    title: string | null;
    lang: string | null;
}

export {Context} from './mfview';

export async function convertForemarkForStaticView(source: string, ctx: MediaHandlerContext): Promise<StaticForemark> {
    const dom = new JSDOM(
        source,
        {contentType: 'application/xhtml+xml'},
    );
    const document = dom.window.document;

    Foremark.setWorkingDom(dom.window);

    // Load the input from the current document
    let inputNode = document.querySelector(`${TagNames.Document},${TagNames.Text},pre`);
    if (inputNode == null) {
        // TODO: Probably should report this in a more appropriate way
        inputNode = document.createElement(TagNames.Document);
        inputNode.innerHTML = `<${TagNames.Error}>
            Could not find <code>&lt;${TagNames.Document}&gt;</code> nor <code>&lt;${TagNames.Text}&gt;</code>.
        </${TagNames.Error}>`;
    }

    // Some of these are just copied from Foremark's `browser-stage1.tsx`

    // `<mf-text>` and `<pre>` are a shorthand syntax for
    // `<mf-document><mf-text>...</mf-text></mf-document>`
    if (/^pre$/i.test(inputNode.tagName)) {
        const mf = document.createElement(TagNames.Document);
        const mfText = document.createElement(TagNames.Text);
        while (inputNode.firstChild) {
            mfText.appendChild(inputNode.firstChild);
        }
        mf.appendChild(mfText);
        inputNode = mf;
    } else if (inputNode.tagName.toLowerCase() === TagNames.Text) {
        const mf = document.createElement(TagNames.Document);
        mf.appendChild(inputNode);
        inputNode = mf;
    }

    Foremark.expandMfText(inputNode);

    // TODO: Probably view transformation should be toggleable
    // TODO: Viewer config
    await prepareForemarkForViewing(inputNode, DEFAULT_VIEWER_CONFIG, ctx);

    // Legalize HTML by moving `mf-sidenote` to valid locations, i.e., outside
    // a paragraph.
    //
    // `mf-sidenote` elements often include block elements which HTML disallows
    // to be in `<p>`.
    //
    // Unfortunately, this changes the page's apperance. A more reliable
    // alternative is to replace with `<p>` with a custom element like
    // `<mf-para>`, but that would require changes to the stylesheet.
    let inPara = false;
    const relocatedElems: Element[] = [];
    function moveSidenotes(node: Node) {
        if (!isElement(node)) {
            return;
        }

        const isPara = node.tagName === 'p';

        if (isPara) {
            inPara = true;
        } else if (node.tagName === ViewTagNames.Sidenote && inPara) {
            // This element has to be moved
            node.parentElement!.removeChild(node);
            relocatedElems.unshift(node);
            return;
        }

        for (let n: Node | null = node.firstChild; n; ) {
            const next = n.nextSibling;
            moveSidenotes(n);
            n = next;
        }

        if (isPara) {
            // Move elements in `relocatedElems` here
            for (const e of relocatedElems) {
                node.parentElement!.insertBefore(e, node.nextSibling);
            }
            relocatedElems.length = 0;
        }
    }
    moveSidenotes(inputNode);

    const html = inputNode.outerHTML;

    // Get the page title
    const titleEl = inputNode.getElementsByTagName(TagNames.Title)[0];
    const title = titleEl ? titleEl.textContent!.trim() : null;

    // Get the language
    const htmlEl = document.getElementsByTagName('html')[0];
    const lang = (htmlEl && htmlEl.lang) || null;

    return {
        html,
        title,
        lang,
    };
}

function isElement(x: Node | null | undefined): x is Element {
    return x != null && x.nodeType === 1;
}
