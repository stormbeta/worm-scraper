"use strict";
const fs = require("mz/fs");
const path = require("path");
const cpr = require("thenify")(require("cpr"));

const BOOK_TITLE = "The Wandering Inn";
const BOOK_AUTHOR = "Pirate Aba";
const BOOK_PUBLISHER = "stormbeta";
const BOOK_ID = "urn:uuid:af4f5de9-3468-4eb3-b847-055283ed17da";

// First paragraph of https://parahumans.wordpress.com/about/
const BOOK_DESCRIPTION = `
An inn is a place to rest, a place to talk and share stories, or a place to find adventures, a starting ground for quests and legends.

In this world, at least. To Erin Solstice, an inn seems like a medieval relic from the past. But here she is, running from Goblins and trying to survive in a world full of monsters and magic. She’d be more excited about all of this if everything wasn’t trying to kill her.

But an inn is what she found, and so that’s what she becomes. An innkeeper who serves drinks to heroes and monsters–

Actually, mostly monsters. But it’s a living, right?

This is the story of the Wandering Inn.`;

const NCX_FILENAME = "toc.ncx";

const COVER_IMG_FILENAME = "cover.png";
const COVER_XHTML_FILENAME = "cover.xhtml";
const COVER_MIMETYPE = "image/png";

module.exports = async (scaffoldingPath, bookPath, contentPath, chaptersPath, manifestPath) => {
  await Promise.all([
    cpr(scaffoldingPath, bookPath, { overwrite: true, confirm: true, filter: noThumbs }),
    getChapters(contentPath, chaptersPath, manifestPath).then(chapters => {
      return Promise.all([
        writeOPF(chapters, contentPath),
        writeNcx(chapters, contentPath)
      ]);
    })
  ]);
};

function noThumbs(filePath) {
  // Thumbs.db causes the strangest errors as Windows has it locked a lot of the time.
  return path.basename(filePath) !== "Thumbs.db";
}

function writeOPF(chapters, contentPath) {
  const manifestChapters = chapters.map(c => {
    return `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`;
  }).join("\n");

  const spineChapters = chapters.map(c => {
    return `<itemref idref="${c.id}"/>`;
  }).join("\n");

  const contents = `<?xml version="1.0"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">

  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${BOOK_TITLE}</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId" opf:scheme="UUID">${BOOK_ID}</dc:identifier>
    <dc:creator opf:file-as="${BOOK_AUTHOR}" opf:role="aut">${BOOK_AUTHOR}</dc:creator>
    <dc:publisher>${BOOK_PUBLISHER}</dc:publisher>
    <dc:description>${BOOK_DESCRIPTION}</dc:description>
    <meta name="cover" content="cover-image"/>
  </metadata>

  <manifest>
<item id="ncx" href="${NCX_FILENAME}" media-type="application/x-dtbncx+xml"/>
<item id="cover" href="${COVER_XHTML_FILENAME}" media-type="application/xhtml+xml"/>
<item id="cover-image" href="${COVER_IMG_FILENAME}" media-type="${COVER_MIMETYPE}"/>
${manifestChapters}
  </manifest>

  <spine toc="ncx">
<itemref idref="cover" linear="no"/>
${spineChapters}
  </spine>

  <guide>
    <reference type="cover" title="Cover" href="${COVER_XHTML_FILENAME}"/>
  </guide>
</package>`;

  return fs.writeFile(path.resolve(contentPath, "content.opf"), contents);
}

function writeNcx(chapters, contentPath) {
  const navPoints = chapters.map((c, i) => {
    return `<navPoint class="chapter" id="${c.id}" playOrder="${i + 1}">
  <navLabel><text>${c.title}</text></navLabel>
  <content src="${c.href}"/>
</navPoint>`;
  }).join("\n");

  const contents = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
 <ncx version="2005-1" xml:lang="en" xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <head>
    <meta name="dtb:uid" content="${BOOK_ID}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>

  <docTitle>
    <text>${BOOK_TITLE}</text>
  </docTitle>

  <docAuthor>
    <text>${BOOK_AUTHOR}</text>
  </docAuthor>

  <navMap>
${navPoints}
  </navMap>
</ncx>`;

  return fs.writeFile(path.resolve(contentPath, NCX_FILENAME), contents);
}

async function getChapters(contentPath, chaptersPath, manifestPath) {
  const hrefPrefix = `${path.relative(contentPath, chaptersPath)}/`;

  const manifestContents = await fs.readFile(manifestPath, { encoding: "utf-8" });
  const manifestChapters = JSON.parse(manifestContents);

  const filenames = await fs.readdir(chaptersPath);

  return filenames
    .filter(f => path.extname(f) === ".xhtml")
    .sort()
    .map((f, i) => {
      return {
        id: path.basename(f),
        title: manifestChapters[i].title,
        href: `${hrefPrefix}${f}`
      };
    });
}
