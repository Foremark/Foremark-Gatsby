// Gatsby plugin API
import * as Gatsby from 'gatsby';
import {convertForemarkForStaticView} from './compile';

export async function onCreateNode(
    {
        node,
        loadNodeContent,
        actions,
        createNodeId,
        reporter,
        createContentDigest,
    }: Gatsby.CreateNodeArgs,
    options: Gatsby.PluginOptions,
): Promise<any> {
    const {createNode, createParentChildLink} = actions;

    if (node.internal.mediaType !== 'application/xhtml+xml' ||
        typeof node.name !== 'string' ||
        !node.name.match(/\.(?:mf|fm)$/i)
    ) {
        return;
    }

    const content: string = await loadNodeContent(node);

    try {
        const converted = await convertForemarkForStaticView(content);

        const foremarkNode: Gatsby.Node = {
            id: createNodeId(`${node.id} >> Foremark`),
            children: [],
            parent: node.id,
            internal: {
                content: converted.html,
                contentDigest: createContentDigest(converted.html),
                owner: void 0 as any,
                type: 'Foremark',
            },
            fileAbsolutePath: void 0,
            title: converted.title,
        };

        if (node.internal.type === 'File') {
            foremarkNode.fileAbsolutePath = node.absolutePath;
            foremarkNode.fileRelativePath = node.relativePath;
            foremarkNode.fileRelativePathWithoutExtension =
                stripExtension(String(node.relativePath));
        }

        createNode(foremarkNode);
        createParentChildLink({parent: node, child: foremarkNode});

        return foremarkNode;
    } catch (err) {
        reporter.panicOnBuild(
            `Error processing Foremark ${
                node.absolutePath ? `file ${node.absolutePath}` : `in node ${node.id}`
            }:\n${err.message}`
        );
    }
}

function stripExtension(x: string): string {
    return x.match(/^(.*?)(?:(?:\.mf|\.fm)\.xhtml)?$/i)![1];
}

export async function createSchemaCustomization(
    {actions}: Gatsby.CreateSchemaCustomizationArgs,
    pluginOoptions: Gatsby.PluginOptions,
): Promise<void> {
    const {createTypes} = actions;
    createTypes(`
        type Foremark implements Node @infer @childOf(mimeTypes: "application/xhtml+xml") {
            id: ID!
        }
    `);
}