"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

test("end screen links to the WeUs flip-card page", () => {
  assert.match(
    html,
    /<a id="powerCardsButton" class="bigButton" href="#cards">翻转卡牌<\/a>/
  );
});

test("end-screen actions share the existing arcade button style", () => {
  assert.match(html, /<div class="endActions">[\s\S]*id="restartButton" class="bigButton"[\s\S]*id="powerCardsButton" class="bigButton"/);
  assert.match(html, /\.endActions \.bigButton\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*text-decoration:\s*none;/);
});

test("flip-card page exposes six cards across the four named WeUs themes", () => {
  assert.match(html, /<section id="cardsPage"/);
  assert.equal((html.match(/class="flipCard"/g) || []).length, 6);
  assert.match(html, /<h1 id="cardsTitle">翻转WeUs卡牌<\/h1>/);
  assert.match(html, /四个主题带你重新认识月经与身体：<strong>月经<\/strong>·<strong>关爱<\/strong>·<strong>连结<\/strong>·<strong>创造<\/strong>/);
  assert.match(html, /<span id="cardsProgress">0 \/ 6 已翻转<\/span>/);
  assert.match(html, /\.cardsGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/);
  assert.match(html, /src="\.\/assets\/cards\/weus-card-cover\.png"/);
  for (const filename of [
    "weus-back-01-period-renewal.webp",
    "weus-back-02-pad-history.webp",
    "weus-back-03-period-equity.webp",
    "weus-back-04-leaders-bleed.webp",
    "weus-back-05-sisterhood.webp",
    "weus-back-06-self-preservation.webp"
  ]) {
    assert.match(html, new RegExp(`src="\\./assets/cards/${filename}"`));
  }
  assert.doesNotMatch(html, /weus-card-placeholder\.png/);
  assert.match(html, /\.flipCard\.is-flipped \.flipCardInner/);
});

test("card page scrolls, preserves WeUs casing, and adds no frame around the artwork", () => {
  assert.match(html, />WeUs · PERIOD POWER CARDS</);
  assert.match(html, /document\.documentElement\.classList\.toggle\("cards-open", shouldOpen\)/);
  assert.match(html, /\.flipCardFace\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(html, /\.flipCardFront img\s*\{[\s\S]*?transform:\s*scale\(1\.067,\s*\.949\);/);
  assert.doesNotMatch(html, /class="cardLabel"/);
});
