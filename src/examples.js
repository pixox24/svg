import { allSketches } from './catalog.js';

export default Object.fromEntries(allSketches().map((item) => [item.id, item.code]));
