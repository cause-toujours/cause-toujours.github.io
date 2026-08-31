const MarkdownIt = require("markdown-it");
const md = new MarkdownIt({ html: true });
const { SafeString } = require("nunjucks").runtime;

module.exports = function (eleventyConfig) {
  eleventyConfig.addFilter("markdownify", (content) =>
    new SafeString(md.renderInline(content || ""))
  );

  eleventyConfig.ignores.add("README.md");
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy("data");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("versions");
  eleventyConfig.addPassthroughCopy("journal-cover.png");
  eleventyConfig.addPassthroughCopy("journal-page3.png");
  eleventyConfig.addPassthroughCopy("une-n001.png");
  eleventyConfig.addPassthroughCopy("une-hero.png");
  eleventyConfig.addPassthroughCopy("crieur.jpg");
  eleventyConfig.addPassthroughCopy("mots-croises-n001.jpeg");
  eleventyConfig.addPassthroughCopy("poster-a2.jpg");
  eleventyConfig.addPassthroughCopy("poster-a2-n001.png");
  eleventyConfig.addPassthroughCopy("logo-cc.png");

  return {
    templateFormats: ["njk", "md"],
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
  };
};
