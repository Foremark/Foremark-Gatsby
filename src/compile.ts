import {JSDOM} from 'jsdom';
import * as Foremark from 'foremark';
import {TagNames} from 'foremark/dist/foremark';

export interface StaticForemark {
    html: string;
    title: string | null;
    lang: string | null;
}

export function convertForemarkForStaticView(source: string): StaticForemark {
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
    } else {
        inputNode.parentElement!.removeChild(inputNode);
    }

    Foremark.expandMfText(inputNode);

    // TOOD: Apply view transformation

    const html = inputNode.outerHTML;

    // Get the page title
    const titleEl = inputNode.getElementsByTagName(TagNames.Title)[0];
    const title = titleEl ? titleEl.textContent!.trim() : null;

    // Get the language
    const htmlEl = document.getElementsByTagName('html')[0];
    const lang = (htmlEl && htmlEl.lang) || null;

    // TODO: Probably should be converted from XHTML to HTML.
    //       (Note that Foremark does not support HTML)
    return {
        html,
        title,
        lang,
    };
}
