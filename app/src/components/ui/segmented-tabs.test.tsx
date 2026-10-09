// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SegmentedTabs } from "./segmented-tabs";

function Rail() {
  const [value, setValue] = useState('general');
  return <><SegmentedTabs tabs={[{id:'general',label:'General'},{id:'appearance',label:'Appearance'},{id:'security',label:'Security'}]} value={value} onChange={setValue} label="Settings sections" orientation="vertical" idPrefix="settings" panelId="panel" /><div role="tabpanel" id="panel" aria-labelledby={`settings-${value}`} /></>;
}
it("uses one Tab stop and wraps arrows, Home and End in a vertical rail", () => {
  render(<Rail />);
  const general = screen.getByRole('tab', { name:'General' });
  general.focus();
  expect(general.tabIndex).toBe(0);
  fireEvent.keyDown(general,{key:'ArrowUp'});
  const security = screen.getByRole('tab',{name:'Security'});
  expect(document.activeElement).toBe(security);
  expect(security.getAttribute('aria-selected')).toBe('true');
  expect(general.tabIndex).toBe(-1);
  fireEvent.keyDown(security,{key:'Home'});
  expect(document.activeElement).toBe(general);
  fireEvent.keyDown(general,{key:'ArrowDown'});
  expect(document.activeElement).toBe(screen.getByRole('tab',{name:'Appearance'}));
  fireEvent.keyDown(document.activeElement!,{key:'End'});
  expect(document.activeElement).toBe(security);
  expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(security.id);
  expect(security.getAttribute('aria-controls')).toBe('panel');
});
