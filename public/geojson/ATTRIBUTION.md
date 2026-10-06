# Europe boundary data

The NOR, SWE, DNK, CHE and ITA files are adapted from the simplified geoBoundaries
gbOpen datasets: https://www.geoboundaries.org/ and
https://github.com/wmgeolab/geoBoundaries (revision 9469f09).

Source levels: NOR/SWE/DNK/CHE ADM1, ITA ADM2 (the 20 Italian regions).
The files retain boundary geometry and add application region IDs and labels.

Licenses and original sources are documented in the country API metadata:

- https://www.geoboundaries.org/api/current/gbOpen/NOR/ADM1/
- https://www.geoboundaries.org/api/current/gbOpen/SWE/ADM1/
- https://www.geoboundaries.org/api/current/gbOpen/DNK/ADM1/
- https://www.geoboundaries.org/api/current/gbOpen/CHE/ADM1/
- https://www.geoboundaries.org/api/current/gbOpen/ITA/ADM2/

Norway uses the 2020 county boundaries, including Viken. The upload pipeline
maps NO-31, NO-32 and NO-33 to this historical region until newer geometry is used.
