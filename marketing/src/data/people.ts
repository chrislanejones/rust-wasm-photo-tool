/* Who works on Image Horse.
 *
 * Data, not JSX, for the same reason `posts.ts` is: `seo.ts` builds the About
 * page's JSON-LD from this list and is imported by the prerender under Node,
 * where a .tsx file full of components cannot go.
 *
 * `bio` is an array of paragraphs rather than one string with "\n\n" in it.
 * The trail-log data made the opposite choice and every consumer has to split
 * it back apart; here the shape is the paragraphs, so no consumer has to know
 * the convention.
 */

export interface Person {
  /** Stable id, used as the React key and the row's anchor. */
  id: string;
  name: string;
  /** One line under the name. Not a job title if a job title says nothing. */
  role: string;
  image: string;
  imageAlt: string;
  /** Intrinsic size, so the row reserves its space and nothing reflows. */
  width: number;
  height: number;
  bio: string[];
  /** A phrase in `bio` that should render as a link. The first occurrence of
   *  `text` in any paragraph becomes the anchor, so `bio` stays plain strings. */
  inlineLinks?: { text: string; href: string }[];
  /** The name in its own script, set beside the Latin one in the heading. */
  nameNative?: string;
  /** Site-relative hrefs ("/contact") are router links; the rest open off-site. */
  links?: { label: string; href: string }[];
}

export const PEOPLE: Person[] = [
  {
    id: "chris",
    name: "Chris Lane Jones",
    role: "Builds Image Horse",
    image: "/chris-and-theo-renderatl.webp",
    // A photo of two people needs both named — "Chris and a friend" tells a
    // screen-reader user less than the sighted reader gets from the caption
    // they can see on the badges.
    imageAlt:
      "Chris Lane Jones and Theo Browne at RenderATL, both wearing conference lanyards, in front of a pink-lit wall.",
    width: 256,
    height: 256,
    bio: [
      "I build web software, mostly in React and Next.js, and I still take WordPress work. Image Horse started because I wanted to crop and compress a photo without handing it to somebody else's server, and the browser turned out to be capable of far more than that.",
      "I graduated from the University of North Florida in 2013 after three communications internships, and started out editing video. Building my own site was more interesting than the editing, so I changed careers.",
      "I ran Richmond's WordPress meetup from January 2022 to January 2025, and before that was Digital Director for the Jacksonville Online Marketing Meetup. Eight years in Virginia — Harrisonburg, then Louisa, close to Richmond and closer to the mountains — and in 2026 we moved back to Florida. I still work remotely for the Commonwealth of Virginia.",
    ],
    links: [
      { label: "chrislanejones.com", href: "https://www.chrislanejones.com" },
      { label: "GitHub", href: "https://github.com/chrislanejones" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    id: "naji",
    name: "Naji",
    nameNative: "ناجي",
    role: "The horse",
    image: "/naji-the-horse.webp",
    imageAlt:
      "Naji, a chestnut horse in a blue and patterned halter, standing under a tree in a fenced green pasture and looking straight at the camera.",
    width: 578,
    height: 778,
    /* ناجي sits in the heading (`nameNative`) rather than in the first
       sentence: the name is the Arabic, and the heading is where a name goes. */
    bio: [
      'Naji — Arabic for "survivor" — is an Arabian horse. He is the only horse of his herd who survived, which is what the name means.',
      "He can be ridden, though he does not make it easy. He lives in Louisa, Virginia, and we are hoping to bring him down to Florida.",
      "He has also worked as a therapy horse: my wife Becky counseled people with him through Heaven's Rays Ministries. A horse notices what a person is carrying before they say it out loud, which turns out to be the whole point.",
      "He is why the editor is named after a horse. A workhorse is a tool that does the job and does not fuss. Image Horse.",
    ],
    inlineLinks: [{ text: "Heaven's Rays Ministries", href: "https://heavensraysministries.com/" }],
  },
];
