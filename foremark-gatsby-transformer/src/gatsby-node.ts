// Gatsby plugin API
import * as Gatsby from 'gatsby';
import {convertForemarkForStaticView, StaticForemark} from './compile';

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

    const foremarkNode: Gatsby.Node = {
        id: createNodeId(`${node.id} >> Foremark`),
        children: [],
        parent: node.id,
        internal: {
            content: node.internal.content,
            contentDigest: node.internal.contentDigest,
            owner: void 0 as any,
            type: 'Foremark',
        },
        fileAbsolutePath: void 0,
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


export async function setFieldsOnGraphQLNodeType(
    {type, cache, basePath}: Gatsby.SetFieldsOnGraphQLNodeTypeArgs,
    options: Gatsby.PluginOptions,
): Promise<object> {
    if (type.name !== 'Foremark') {
        return {};
    }

    const mkCacheKey = (node: Gatsby.Node, type: string) =>
      `transformer-foremark-${type}-${node.internal.contentDigest}-${basePath}`

    const convertedCacheKey = (node: Gatsby.Node) => mkCacheKey(node, 'html');

    async function getConverted(foremarkNode: Gatsby.Node): Promise<StaticForemark> {
        const convertedContent = await cache.get(convertedCacheKey(foremarkNode));
        if (convertedContent) {
            return convertedContent;
        } else {
            const content = foremarkNode.internal.content!;
            if (content == null) {
                throw new Error("content is null");
            }

            const converted = await convertForemarkForStaticView(content);
            cache.set(convertedCacheKey(foremarkNode), converted);
            return converted;
        }
    }

    async function getHtml(foremarkNode: Gatsby.Node): Promise<string> {
        return (await getConverted(foremarkNode)).html;
    }

    async function getTitle(foremarkNode: Gatsby.Node): Promise<string> {
        return (await getConverted(foremarkNode)).title || '';
    }

    return {
        html: {
            type: 'String',
            resolve: getHtml,
        },
        title: {
            type: 'String',
            resolve: getTitle,
        },
    };
}