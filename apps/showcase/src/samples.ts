import { emailProfile, slidesProfile, webProfile, type EditorProfile } from '@visual-html/core';
import type { HtmlDeck } from '@visual-html/deck';
import ribbonArtwork from './assets/chrome-ribbon.webp?inline';

export type ProfileId = 'email' | 'slides' | 'web';

export interface ShowcaseProfile {
  id: ProfileId;
  shortLabel: string;
  eyebrow: string;
  description: string;
  profile: EditorProfile;
  html: string;
}

const emailHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Course welcome</title>
</head>
<body style="margin: 0; padding: 36px 12px; background-color: #ece9ef; color: #302838; font-family: Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tbody>
      <tr>
        <td align="center">
          <table id="email-content" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: #faf7f1; border-radius: 3px; overflow: hidden;">
            <tbody>
              <tr>
                <td style="padding: 26px 44px; border-style: solid; border-color: #ded6cc; border-width: 0 0 1px; color: #322835;">
                  <p style="margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase;">Open Learning</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 39px 44px 18px;">
                  <p style="margin: 0 0 20px; color: #82698e; font-size: 10px; font-weight: 400; text-transform: uppercase; letter-spacing: 2px;">Your learning path</p>
                  <h1 style="margin: 0 0 20px; font-family: Georgia, serif; font-style: italic; font-weight: 400; font-size: 52px; line-height: 1.04; letter-spacing: -2px; color: #302838;">Build skills that move with you.</h1>
                  <p style="margin: 0; color: #756a76; font-size: 15px; line-height: 1.8;">Your new course is ready. Learn in short, focused sessions and put every idea into practice.</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 44px 35px;">
                  <a href="#course" style="display: inline-block; padding: 14px 22px; border-radius: 3px; background-color: #3a2d45; color: #faf3ff; font-size: 12px; font-weight: 400; text-decoration: none;">Continue learning</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 0; background-color: #0b0c10;"><img src="${ribbonArtwork}" alt="A sculptural glass ribbon opening into a new perspective" width="600" height="250" style="display: block; width: 100%; height: 250px; object-fit: cover;"></td>
              </tr>
              <tr>
                <td style="padding: 24px 44px; background-color: #f4efe8; color: #867987; font-size: 10px; line-height: 1.7;">You received this message because you enrolled in this learning experience.</td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;

const slidesHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Learning slide</title>
</head>
<body style="margin: 0; min-height: 100%; overflow: hidden; background-color: #17151f; color: #ffffff; font-family: Arial, sans-serif;">
  <main style="position: relative; width: 100%; height: 100%; min-height: 700px; overflow: hidden; background-color: #17151f;">
    <div style="position: absolute; top: -140px; right: -70px; width: 440px; height: 440px; border-radius: 50%; background-color: #765df6; opacity: 0.85;"></div>
    <div style="position: absolute; right: 90px; bottom: 70px; width: 260px; height: 190px; border-radius: 28px; background-color: #ffbd67; transform: rotate(-7deg);"></div>
    <section style="position: absolute; top: 105px; left: 9%; width: 62%;">
      <p style="margin: 0 0 22px; color: #b8aaff; font-size: 16px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">Module 03 - Product thinking</p>
      <h1 style="margin: 0; max-width: 720px; font-size: 72px; line-height: 1.02; letter-spacing: -3px;">Make the complex feel obvious.</h1>
      <p style="margin: 30px 0 0; max-width: 570px; color: #c8c2d3; font-size: 23px; line-height: 1.5;">Great learning design turns dense ideas into a sequence people can see, understand, and remember.</p>
    </section>
    <p style="position: absolute; left: 9%; bottom: 58px; margin: 0; color: #878091; font-size: 14px;">07 / 24</p>
  </main>
</body>
</html>`;

const slidesHtmlTwo = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Three layers of clarity</title>
</head>
<body style="margin: 0; min-height: 100%; overflow: hidden; background-color: #f4f0e8; color: #1e2026; font-family: Arial, sans-serif;">
  <main style="box-sizing: border-box; display: flex; width: 100%; height: 100%; min-height: 700px; align-items: center; gap: 7%; padding: 8%; background-color: #f4f0e8;">
    <section style="width: 43%;">
      <p style="margin: 0 0 20px; color: #6253d8; font-size: 15px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">A simple operating model</p>
      <h1 style="margin: 0; font-size: 62px; line-height: 1.02; letter-spacing: -3px;">Clarity happens in layers.</h1>
      <p style="margin: 28px 0 0; color: #6d6962; font-size: 21px; line-height: 1.55;">Start with the signal, shape a direction, then make the next action unmistakable.</p>
    </section>
    <section style="display: grid; width: 45%; gap: 16px;">
      <article style="padding: 24px 26px; border-radius: 18px; color: #ffffff; background-color: #24222a;"><strong style="color: #9bf0c7;">01</strong><h2 style="margin: 9px 0 5px; font-size: 27px;">Find the signal</h2><p style="margin: 0; color: #bbb6c2; font-size: 16px; line-height: 1.5;">Separate evidence from noise.</p></article>
      <article style="padding: 24px 26px; border-radius: 18px; color: #ffffff; background-color: #6555df;"><strong style="color: #dcd6ff;">02</strong><h2 style="margin: 9px 0 5px; font-size: 27px;">Shape direction</h2><p style="margin: 0; color: #e1ddf7; font-size: 16px; line-height: 1.5;">Turn the signal into a coherent choice.</p></article>
      <article style="padding: 24px 26px; border: 1px solid #d8d1c6; border-radius: 18px; background-color: #ffffff;"><strong style="color: #6253d8;">03</strong><h2 style="margin: 9px 0 5px; font-size: 27px;">Make it actionable</h2><p style="margin: 0; color: #706b64; font-size: 16px; line-height: 1.5;">Give people one obvious next step.</p></article>
    </section>
  </main>
</body>
</html>`;

const slidesHtmlThree = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Make the next move visible</title>
</head>
<body style="margin: 0; min-height: 100%; overflow: hidden; background-color: #dff7eb; color: #183128; font-family: Arial, sans-serif;">
  <main style="position: relative; box-sizing: border-box; width: 100%; height: 100%; min-height: 700px; overflow: hidden; padding: 8%; background-color: #dff7eb;">
    <div style="position: absolute; top: -22%; right: -7%; width: 48%; aspect-ratio: 1; border-radius: 50%; background-color: #9bf0c7;"></div>
    <div style="position: absolute; right: 8%; bottom: 9%; width: 31%; height: 31%; border-radius: 34px; background-color: #24222a; transform: rotate(5deg);"></div>
    <section style="position: relative; z-index: 2; width: 62%; padding-top: 7%;">
      <p style="margin: 0 0 22px; color: #3f765f; font-size: 16px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">The takeaway</p>
      <h1 style="margin: 0; max-width: 820px; font-size: 78px; line-height: 0.98; letter-spacing: -4px;">Make the next move visible.</h1>
      <p style="margin: 32px 0 0; max-width: 650px; color: #426253; font-size: 23px; line-height: 1.55;">People remember a complex idea when they can connect it to a concrete decision.</p>
    </section>
  </main>
</body>
</html>`;

export const showcaseSlidesDeck: HtmlDeck = {
  schema: 'visual-html-deck',
  version: 1,
  id: 'product-thinking-deck',
  title: 'Product thinking',
  width: 1600,
  height: 900,
  slides: [
    { id: 'opening', label: '01', title: 'Make the complex feel obvious', notes: 'Open by reframing clarity as a design outcome.', html: slidesHtml },
    { id: 'model', label: '02', title: 'Clarity happens in layers', notes: 'Walk through the three layers from signal to action.', html: slidesHtmlTwo },
    { id: 'takeaway', label: '03', title: 'Make the next move visible', notes: 'Close with the practical takeaway.', html: slidesHtmlThree }
  ]
};

const webHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Course landing page</title>
</head>
<body style="margin: 0; color: #1f2724; background-color: #f7f8f3; font-family: Arial, sans-serif;">
  <header style="display: flex; align-items: center; justify-content: space-between; padding: 22px 6%; border-bottom: 1px solid #dfe4dc; background-color: #f7f8f3;">
    <strong style="font-size: 19px; letter-spacing: -1px;">Northstar Academy</strong>
    <a href="#curriculum" style="color: #1f2724; font-size: 14px; font-weight: 700; text-decoration: none;">View curriculum</a>
  </header>
  <main>
    <section style="display: flex; align-items: center; gap: 7%; padding: 76px 6%; background-color: #e4f0e8;">
      <div style="width: 56%;">
        <p style="margin: 0 0 15px; color: #3f6d54; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Live cohort - 6 weeks</p>
        <h1 style="margin: 0; max-width: 680px; font-size: 62px; line-height: 1.02; letter-spacing: -3px;">Lead product teams with clarity.</h1>
        <p style="margin: 24px 0 30px; max-width: 590px; color: #51615a; font-size: 19px; line-height: 1.65;">A practical program for turning uncertainty into aligned decisions, stronger teams, and products customers value.</p>
        <a href="#enroll" style="display: inline-block; padding: 15px 21px; border-radius: 10px; color: #ffffff; background-color: #24523b; font-size: 14px; font-weight: 700; text-decoration: none;">Reserve your seat</a>
      </div>
      <aside style="width: 37%; padding: 30px; border-radius: 24px; color: #ffffff; background-color: #24523b; box-shadow: 0 24px 55px #a8b8ad;">
        <p style="margin: 0 0 42px; color: #bcd8c6; font-size: 13px;">NEXT COHORT</p>
        <h2 style="margin: 0 0 8px; font-size: 30px;">September 14</h2>
        <p style="margin: 0; color: #d9e7dd; line-height: 1.6;">12 live sessions - Expert coaching - Capstone project</p>
      </aside>
    </section>
    <section id="curriculum" style="display: flex; gap: 24px; padding: 55px 6%; background-color: #ffffff;">
      <article style="width: 33%; padding: 24px; border: 1px solid #e3e5df; border-radius: 16px;"><strong>01</strong><h3 style="font-size: 21px;">Find the signal</h3><p style="color: #69736e; line-height: 1.6;">Frame the real problem before committing the team.</p></article>
      <article style="width: 33%; padding: 24px; border: 1px solid #e3e5df; border-radius: 16px;"><strong>02</strong><h3 style="font-size: 21px;">Shape direction</h3><p style="color: #69736e; line-height: 1.6;">Connect evidence, strategy, and a compelling narrative.</p></article>
      <article style="width: 33%; padding: 24px; border: 1px solid #e3e5df; border-radius: 16px;"><strong>03</strong><h3 style="font-size: 21px;">Build momentum</h3><p style="color: #69736e; line-height: 1.6;">Create operating rhythms that keep decisions moving.</p></article>
    </section>
  </main>
</body>
</html>`;

export const showcaseProfiles: Record<ProfileId, ShowcaseProfile> = {
  email: {
    id: 'email',
    shortLabel: 'Email',
    eyebrow: 'Table-safe editing',
    description: 'Preserve the markup email clients expect while giving content teams a visual surface.',
    profile: emailProfile,
    html: emailHtml
  },
  slides: {
    id: 'slides',
    shortLabel: 'Slides',
    eyebrow: 'Fixed canvas',
    description: 'Directly move and resize elements across configurable presentation aspect ratios.',
    profile: slidesProfile,
    html: slidesHtml
  },
  web: {
    id: 'web',
    shortLabel: 'Web',
    eyebrow: 'Responsive flow',
    description: 'Edit responsive landing pages without replacing their authored HTML structure.',
    profile: webProfile,
    html: webHtml
  }
};

