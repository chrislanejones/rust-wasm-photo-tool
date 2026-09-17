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
  links?: { label: string; href: string }[];
}

export const PEOPLE: Person[] = [
  {
    id: "chris",
    name: "Chris Lane Jones",
    role: "Builds Image Horse",
    image: "/Image-Horse-Logo.svg",
    imageAlt: "",
    width: 500,
    height: 500,
    bio: [
      "I build web software, mostly in React and Next.js, and I still take WordPress work. Image Horse started because I wanted to crop and compress a photo without handing it to somebody else's server, and the browser turned out to be capable of far more than that.",
      "I graduated from the University of North Florida in 2013 after three communications internships, and started out editing video. Building my own site was more interesting than the editing, so I changed careers.",
      "I ran Richmond's WordPress meetup from January 2022 to January 2025, and before that was Digital Director for the Jacksonville Online Marketing Meetup. Eight years in Virginia — Harrisonburg, then Louisa, close to Richmond and closer to the mountains — and in 2026 we moved back to Florida. I still work remotely for the Commonwealth of Virginia.",
    ],
    links: [
      { label: "chrislanejones.com", href: "https://www.chrislanejones.com" },
      { label: "GitHub", href: "https://github.com/chrislanejones" },
    ],
  },
  {
    id: "naji",
    name: "Naji",
    role: "The horse",
    image: "/naji-the-horse.webp",
    imageAlt:
      "Naji, a chestnut horse in a blue and patterned halter, standing under a tree in a fenced green pasture and looking straight at the camera.",
    width: 578,
    height: 778,
    // Deliberately one line. Chris asked for the row now and the words later,
    // and a placeholder that pretends to be a bio is worse than one that says
    // what it is. Replace this array when there is something to say.
    bio: ["Info coming soon."],
  },
];
