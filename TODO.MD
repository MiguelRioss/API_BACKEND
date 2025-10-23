## TODO 

https://chatgpt.com/g/g-p-68a6e20ab0c88191958f694dcc5dc007-miguelstuff/c/68d37050-6b54-8326-b5bf-038fd795989a
* [X] ~~*OPTIMIZAR A PROCURA*~~ [2025-09-25] 
* [X] ~~*Atualizar o track_URL*~~ [2025-09-25]
* 
* [X] ~~*POR A BASE DE DADOS A DAR FETCH EM TODOS*~~ [2025-10-03] 
  * [X] ~~*Fazer uma chamada api que se chama updateStatus , onde recebe o id e o status e vai fazer o update , ao chamar a função ja existente da base de dados*~~ [2025-10-03]
  * [X] ~~*O react neste momento esta a por no body algo como changes , temos de tirar a responsabilidade do front end de fazer isso*~~ [2025-10-03]
    Quem faz isso é o API em que ve o body e vai buscar os objectos que estao la e encapsula num {changes : " objetos"}
    /2
* [X] ~~*FAZER COMPRA COM O WEBHOOK A PUXAR A BASE DE DADOS*~~ [2025-10-03]



* [X] ~~*When i create should allways have the accepted , in transit , delivered, and ....*~~ [2025-09-25]



## SUPER TODO
* [X] ~~*Procurar todos os erros possiveis na camada de services e tirar essas reponsabilidade se existir das outras camadas*~~ [2025-09-29]



* [X] ~~*VER COMO MEXER NO STOCK COMO DE ANTES*~~ [2025-10-03]
  * [X] ~~*Os produtos tem de estar na base de dados como no stock , e vou trabalhar a partir dai*~~ [2025-10-03]
  * [X] ~~*O produto quando vai adicionar algo ao carrinho tem de saber o stock antes*~~ [2025-10-03] 
  * [X] ~~*O id do produto vem dai*~~ [2025-10-03] 
  * [X] ~~*Nos stock o id do produto tem de ser int*~~ [2025-10-03] 


- [X] ~~*See if there is a way of only putting the data in my web site*~~ [2025-10-15]
  - [X] ~~*Maybe when comming from the website it will full filled all that data and i dont have to put that info there*~~ [2025-10-15]
    - [X] ~~*If they want they can change biiling adress from the delivering addres with checkButton?*~~ [2025-10-15] 
  - [X] ~~*See if there is a way of sending a better looking email and the receipe will be on pdf*~~ [2025-10-15] 
  - [X] ~~*Can i create a pdf For ibogenics template and then use pdf to create the invoice*~~ [2025-10-15]
* [X] ~~*THere should be no error with writed failed http violation*~~ [2025-10-15]
  

  


  - [ ] Email 
    - [ ] -> diferente para New payment Request
      * [ ] New PaymentRequest Template 
    - [ ] -> A informação template ja feito
      - [ ] Mas tem de confirmar com email para o alvaro com o comprovativo de pagamento 





((Must have in the email TEMPLATE ))
Once you have paid , please provide us with proof of payment( WISE transaction # or Revolut @TAG) 
and be sure to include the information bellow:
- OrderID 
- Full name
- Full address
- Country
- Phone number
- Email address
- Copy of the payment receipt



Dias para o codigo 31 dias 
-> multiple use codes
-> one time uses

Ultimo dia para usar o codigo 
Deve estar lá no codigo 

 -> Possivel email 