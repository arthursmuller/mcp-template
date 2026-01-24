tool:
- update scaffold-tool to import the domainservice class to be used for new tool.ts record if the domainservice class is not yet imported in the mcp/tools.ts file.

domain:
- add scaffold-domain script.
- update scaffold domain script to add option to include a apiclient.client.ts that implements the src/api/client. httpclient class in its ctor. and the serviceclass.service.ts implements the apiclient.client.ts 


services:
Add scaffold tool to add a service, 
- it should ask for if user wants to add a method name, if so, it should also create the methodName.dto.ts file with the request/response dto by the given method name.
- it should ask if want to use in the new service ctor an existing domain/clients/.db.client (list names, list the domain .db.client names (same as in the scaffold tool services)) or if wants to create a new .db.client.ts, if wants to create a .db.client.ts ask for the name of the .db.client
- it should ask if want to use in the new service ctor an existing domain/clients/.http.client (list names, list the domain .http.client names (same as in the scaffold tool services))or if wants to create a new .http.client.ts, if wants to create a .http.client.ts ask for the name of the .http.client


readme:
- Update readme to talk about new-tool script.