startup-project:
update startup-project handle the new domain dir "clients" and update the domain.db.client.ts and domain.http.client.ts name to the domain name, save as in service, and also ask for a domain client method name and use it for both .db and .http.


tool:
- update scaffold-tool to import the domainservice class to be used for new tool.ts record if the domainservice class is not yet imported in the mcp/tools.ts file.
- update scaffold-tool to check if any client exists in src/domain/{domain-name}/clients, and if so add ask an optional domainApiClient method name.

domain:
- add scaffold-domain script.
-update scaffold domain script to add option to include a apiclient.client.ts that implements the src/api/client. httpclient class in its ctor. and the serviceclass.service.ts implements the apiclient.client.ts 


services:
Add scaffold tool to add a service, and ask if want to implement a domain client, if so, list the domain/clients to implement in the new service ctor or ask if want to create a new client in the clients dir to add in the new service ctor.


that implements a src/domain/{domain-name}/clients

readme:
- Update readme to talk about new-tool script.