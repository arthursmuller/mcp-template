domain:
- add scaffold-domain script.
it should ask for the domain name
it should ask if want to add http.client.ts -> yes, then {domainName}.http.client.ts
it should ask if want to add db.client.ts -> yes, then {domainName}.db.client.ts
it should ask the clients method name, the same name should be used for both.client.ts .db and .http.client.ts
it should add services/{domain-name}.service.ts 
it should ask the service method name, 
it should add dtos/methodName.dto.ts response/request dtos

domain db.client:
it should list the domains. if no domain exists, show message to add a domain
add a scaffold tool to add a new http.client.ts that implements the api/client.ts

domain db.client:
it should list the domains. if no domain exists, show message to add a domain
add a scaffold tool to add a new db.client.ts 

readme:
- Update readme to talk about new-tool script.