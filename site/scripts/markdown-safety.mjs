const safeURL = input => {
  const value = String(input).trim();
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  return !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value) || /^(?:https?:|mailto:)/i.test(value);
};

/** Markdown is content, not a script/template language. Do not enable raw HTML or MDX. */
export function remarkSafeContent() {
  return tree => {
    const visit = node => {
      if (node.children) {
        node.children = node.children.filter(child => child.type !== 'html');
        node.children.forEach(visit);
      }
      if (['link', 'image', 'definition'].includes(node.type) && !safeURL(node.url ?? '')) {
        throw new Error(`Unsupported Markdown URL scheme: ${node.url}`);
      }
    };
    visit(tree);
  };
}
