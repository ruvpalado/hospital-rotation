import { useEffect, useState } from 'react';
import api from '../api/axios';

/**
 * Loads sites (with their departments) once and exposes color lookups so every
 * screen in the app renders the same color for a given site/department code,
 * satisfying the "color coding for each site and its department" requirement.
 */
export function useColorMaps() {
  const [siteColors, setSiteColors] = useState({});
  const [deptColors, setDeptColors] = useState({});
  const [sites, setSites] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    api.get('/sites').then((res) => {
      setSites(res.data);
      const sMap = {};
      const dMap = {};
      res.data.forEach((s) => {
        sMap[s.short_code] = s.color_hex;
        (s.Departments || []).forEach((d) => {
          dMap[d.code] = d.color_hex;
        });
      });
      setSiteColors(sMap);
      setDeptColors(dMap);
    });
    api.get('/departments').then((res) => {
      setDepartments(res.data);
      setDeptColors((prev) => {
        const merged = { ...prev };
        res.data.forEach((d) => { merged[d.code] = d.color_hex; });
        return merged;
      });
    });
  }, []);

  return { siteColors, deptColors, sites, departments };
}

export function colorFor(map, key, fallback = '#888888') {
  return map[key] || fallback;
}
