// Which stem figures a student sees, where the bank holds one drawing more
// than once. Checked by eye against each booklet crop (2026-10-20, owner
// report: CS 1404 q61 showed the whole question as a picture above its own
// diagram and code). Keys are the build's media keys (`figN`, N = the figure's
// place among the record's crops). An empty list shows no figure: the stem
// text and the options already carry everything.
//
// Typical cases: the booklet's automatic crop and a cleaner hand cut of the
// same drawing (keep the hand cut); a crop of the whole question with the
// drawing inside (drop it); the four options cut again as stem pieces while
// they already are the options (drop them).

export const FIGURE_PICKS = new Map([
  ["kunkurcomputer-q-1209-1380-b0-025", ["fig1"]],
  ["kunkurcomputer-q-1209-1380-b0-109", ["fig2"]],
  ["kunkurcomputer-q-1209-1381-b0-072", ["fig2"]],
  ["kunkurcomputer-q-1209-1382-b0-105", ["fig2"]],
  ["kunkurcomputer-q-1209-1383-b0-060", ["fig2"]],
  ["kunkurcomputer-q-1209-1383-b0-072", ["fig2"]],
  ["kunkurcomputer-q-1209-1383-b0-077", ["fig1"]],
  ["kunkurcomputer-q-1209-1383-b0-082", ["fig1", "fig3"]],
  ["kunkurcomputer-q-1209-1385-b0-082", ["fig2"]],
  ["kunkurcomputer-q-1209-1386-309-063", ["fig1"]],
  ["kunkurcomputer-q-1209-1387-b0-061", ["fig1"]],
  ["kunkurcomputer-q-1209-1388-D-065", ["fig1"]],
  ["kunkurcomputer-q-1209-1390-372B-058", ["fig1"]],
  ["kunkurcomputer-q-1209-1390-372B-061", ["fig1"]],
  ["kunkurcomputer-q-1209-1390-372B-063", []],
  ["kunkurcomputer-q-1209-1390-372B-086", ["fig5"]],
  ["kunkurcomputer-q-1209-1392-370C-058", ["fig2"]],
  ["kunkurcomputer-q-1209-1392-370C-060", ["fig1"]],
  ["kunkurcomputer-q-1209-1392-370C-065", ["fig2"]],
  ["kunkurcomputer-q-1209-1392-370C-089", ["fig2"]],
  ["kunkurcomputer-q-1209-1393-370E-098", ["fig3"]],
  ["kunkurcomputer-q-1209-1393-370E-167", []],
  ["kunkurcomputer-q-1209-1393-370E-188", ["fig3"]],
  ["kunkurcomputer-q-1209-1393-370E-196", ["fig1"]],
  ["kunkurcomputer-q-1209-1394-371F-097", []],
  ["kunkurcomputer-q-1209-1394-371F-187", []],
  ["kunkurcomputer-q-1209-1395-271F-096", ["fig2"]],
  ["kunkurcomputer-q-1209-1395-271F-099", ["fig2"]],
  ["kunkurcomputer-q-1209-1395-271F-189", ["fig2"]],
  ["kunkurcomputer-q-1209-1395-271F-193", ["fig2"]],
  ["kunkurcomputer-q-1209-1396-265A-104", ["fig2"]],
  ["kunkurcomputer-q-1209-1396-265A-194", ["fig2"]],
  ["kunkurcomputer-q-1209-1398-861A-075", ["fig2"]],
  ["kunkurcomputer-q-1209-1399-462F-083", ["fig2"]],
  ["kunkurcomputer-q-1209-1400-660A-069", ["fig2"]],
  ["kunkurcomputer-q-1209-1403-259A-089", ["fig2"]],
  ["kunkurcomputer-q-1209-1404-460C-061", ["fig2", "fig4"]],
  ["kunkurcomputer-q-1209-1404-460C-077", ["fig3"]],
  ["kunkurcomputer-q-1277-1390-b1-066", ["fig1"]],
]);
