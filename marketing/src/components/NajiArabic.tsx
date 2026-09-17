import type { CSSProperties } from "react";

/* ناجي — "survivor" — as outlines, not text.
 *
 * ⚠️ THIS IS A PICTURE OF A WORD ON PURPOSE, and the reason is that the site
 * could not render it otherwise without adding a font. Geist has no Arabic
 * coverage, and a browser only falls through to a system face if the system
 * HAS one — measured in a clean container, `serif`, `Geist` and a deliberately
 * bogus family all returned the SAME width for this string, which is the
 * signature of fallback boxes rather than glyphs. Anyone on a device without
 * Arabic coverage saw a blank gap mid-sentence.
 *
 * The alternative was Noto Naskh Arabic on the Google Fonts request, which
 * works but spends a third-party font download on one word — on a site whose
 * pitch is about what does not leave your machine. These outlines are 2.7 KB
 * inline, need no request at all, and cannot fail to render.
 *
 * HOW IT WAS MADE, so it can be remade: HarfBuzz shaped the string against
 * Noto Naskh Arabic 600 (Arabic letters JOIN — the four characters become
 * seven glyphs, four letterforms plus three dot marks, and which form each
 * letter takes depends on its neighbours), then fontTools walked the resulting
 * glyph outlines. Hand-picking Unicode presentation forms instead is how you
 * ship a word that is subtly the wrong shape.
 *
 * ⚠️ `y_offset` FROM HARFBUZZ IS Y-UP AND THE PEN IS Y-DOWN. Applying the mark
 * offsets without flipping their sign put the nun's dot above the word and
 * dropped the yeh's dots entirely — it looked almost right, which is the
 * dangerous kind of wrong for a name.
 *
 * Coordinates are rounded to whole font units: at upem 1000 rendered near
 * 20px, a fractional unit is about a fiftieth of a pixel and cannot survive
 * rasterisation. 2,654 -> 2,212 bytes of path. Rasterised at 400x250 and
 * diffed against the unrounded version, 573 of 100,000 pixels differ by more
 * than 8 alpha — 0.57%, all of it antialiasing along the edges. Not
 * byte-identical; measured rather than claimed.
 *
 * It is not selectable text. The accessible name carries the word, and the
 * sentence around it says "Naji" in Latin, so nothing depends on the picture.
 */

const VIEW_BOX = "68.00 -677.00 1775.00 1105.00";

export default function NajiArabic({ style }: { style?: CSSProperties }) {
  return (
    <svg
      viewBox={VIEW_BOX}
      /* Sized in `em` so it tracks the paragraph rather than a fixed px value,
         and nudged down by a fraction so the baseline sits with the Latin. */
      style={{ height: "1.05em", width: "auto", verticalAlign: "-0.18em", ...style }}
      role="img"
      lang="ar"
      aria-label="ناجي"
    >
      <path d="M370 413Q348 396 332 381Q315 366 302 351Q316 338 332 320Q349 303 368 282Q376 291 392 306Q407 321 430 343Q406 378 370 413ZM230 428Q208 410 191 394Q174 379 162 365Q178 350 194 332Q211 315 229 297Q237 306 252 322Q268 337 291 358Q279 375 264 392Q249 410 230 428Z M285 255Q180 255 124 204Q68 152 68 56Q68 38 70 18Q72-2 78-28Q83-53 91-84L133-74Q120-27 120 3Q120 73 164 111Q207 149 293 149Q359 149 416 141Q472 133 521 120Q545 113 568 104Q592 96 611 85Q583 72 552 56Q522 40 496 24Q471 8 455-3Q430-23 430-31Q430-40 436-56Q442-71 450-88Q458-104 466-116Q474-127 477-127Q519-119 575-114Q631-110 695-110Q706-110 706-100V-16Q706-6 695-6Q673-6 645-8Q617-10 590-14Q562-18 542-23Q574-8 593 2Q612 12 623 18Q634 25 641 31Q651 39 654 54Q657 68 657 84Q657 109 632 136Q606 162 560 186Q515 210 456 228Q366 255 285 255Z M1043 177Q995 138 968 107Q992 83 1010 64Q1028 45 1041 29Q1054 43 1072 60Q1089 78 1111 99Q1100 116 1082 136Q1065 155 1043 177Z M689-6Q681-6 681-14V-102Q681-110 689-110Q762-110 816-114Q869-118 915-131Q966-148 997-156Q1028-165 1047-169Q1032-178 1016-188Q1001-198 986-209Q951-234 928-244Q905-253 882-253Q852-253 827-245Q802-237 767-214Q758-223 752-238Q747-253 747-267Q747-309 784-335Q821-361 878-361Q910-361 940-350Q971-338 1010-310Q1058-277 1096-258Q1133-239 1180-227Q1203-222 1233-219Q1263-216 1300-216L1252-121Q1226-123 1206-125Q1185-127 1159-126Q1136-124 1112-118Q1087-111 1060-99Q1034-87 1003-70Q964-48 932-36Q900-23 866-16Q832-10 790-8Q747-6 689-6Z M1619-6Q1566-6 1532-23Q1497-40 1479-68Q1461-97 1457-135Q1454-157 1450-198Q1445-239 1440-292Q1435-344 1430-401Q1424-458 1419-514Q1414-569 1410-614Q1434-632 1460-648Q1485-663 1512-677Q1515-601 1516-526Q1517-451 1519-373Q1521-295 1525-210L1529-136Q1548-122 1570-116Q1593-110 1621-110Q1627-110 1627-102V-14Q1627-6 1619-6Z M1750-464Q1702-503 1675-534Q1699-558 1717-577Q1735-596 1748-612Q1761-598 1778-580Q1796-563 1818-542Q1807-525 1790-506Q1772-486 1750-464Z M1610-6Q1602-6 1602-14V-102Q1602-110 1610-110Q1659-110 1708-119Q1757-128 1788-142Q1779-165 1766-193Q1752-221 1742-242Q1732-264 1726-280Q1720-295 1720-307Q1720-331 1744-358Q1768-385 1802-403Q1808-377 1816-342Q1823-306 1831-264Q1837-232 1840-210Q1843-188 1843-176Q1843-155 1832-124Q1821-92 1805-61Q1714-6 1610-6Z" fill="currentColor" />
    </svg>
  );
}
