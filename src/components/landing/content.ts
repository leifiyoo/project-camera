// Copy for the landing page. Search engines index the phone layout, so this is the text they
// read; keep it true to what the studio does. The FAQ also feeds the page's structured data.
export const features = [
  {
    title: '3D camera',
    text: 'Zoom, rotate and tilt your image in true perspective. Widen or narrow the field of view.',
  },
  {
    title: 'Depth blur',
    text: 'Set the focus point by hand or automatically, and choose how softly the rest falls away.',
  },
  {
    title: 'Backgrounds and style',
    text: 'A color, a gradient, an image or nothing at all. Rounded corners, a stroke, a soft shadow.',
  },
  {
    title: 'Text and logos',
    text: 'Place a headline, a caption or your logo on the canvas.',
  },
  {
    title: 'Every format',
    text: 'Slides, posts or stories: 16:9, 3:2, 4:3, 1:1, 4:5, 9:16 or 21:9.',
  },
  {
    title: 'Export up to 4K',
    text: 'PNG at HD, 2K, 4K or a custom size, with a transparent background if you need one.',
  },
  {
    title: 'Projects',
    text: 'Save your work in the browser, or take it to another computer as a project file.',
  },
] as const;

// The promises the page leads with, as short chips under the headline.
export const facts = ['Free', 'No upload', 'No watermark', 'Up to 4K'] as const;

export const steps = [
  {
    title: 'Add your image',
    text: 'Drop a screenshot or photo onto the page, paste it from the clipboard, or upload a PNG, JPG, WebP, AVIF, GIF or SVG file.',
  },
  {
    title: 'Frame the shot',
    text: 'Hold Ctrl or ⌘ and drag to rotate the camera, scroll to zoom. Pick a focus point, set the blur, style the background.',
  },
  {
    title: 'Export a PNG',
    text: 'Choose HD, 2K, 4K or a custom size and download. Save the project to keep editing later.',
  },
] as const;

export const faq = [
  {
    question: 'Is Project Camera free?',
    answer:
      'Yes. There is no account, no subscription and no watermark. Project Camera is open source under the GNU General Public License v3.',
  },
  {
    question: 'Are my images uploaded to a server?',
    answer:
      "No. Everything happens in your browser and your images never leave your device. Projects are saved in your browser's storage, so clearing site data deletes them. Export a project file to keep a backup.",
  },
  {
    question: 'Which file types can I use?',
    answer: 'You can import PNG, JPG, WebP, AVIF, GIF and SVG images.',
  },
  {
    question: 'How large can I export?',
    answer:
      // Non-breaking spaces keep each size on one line.
      'PNG files at HD (1920\u00a0px), 2K (2560\u00a0px), 4K (3840\u00a0px) or a custom size, with or without a transparent background.',
  },
  {
    question: 'Does it work on a phone or tablet?',
    answer:
      'The studio is built for a computer with a mouse and keyboard. It works best in a current version of Chrome, Edge or Safari, and its 3D perspective and depth blur need WebGL.',
  },
] as const;
