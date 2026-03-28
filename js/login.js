function fazerLogin() {
    const orgao = document.getElementById('orgao').value;
    const login = document.getElementById('login').value.trim();
    const senha = document.getElementById('senha').value.trim();
    const errorMsg = document.getElementById('error-msg');

    let autenticado = false;

    // Lógica simples de autenticação
    if (orgao === 'prefeitura' && login === 'prefeitura' && senha === 'pmp10') {
        autenticado = true;
    } else if (orgao === 'fmas' && login === 'fmas' && senha === 'fmas10') {
        autenticado = true;
    } else if (orgao === 'fme' && login === 'fme' && senha === 'fme10') {
        autenticado = true;
    } else if (orgao === 'fms' && login === 'fms' && senha === 'fms10') {
        autenticado = true;
    }

    if (autenticado) {
        // Salva o órgão logado na sessão para usarmos depois no Firebase
        sessionStorage.setItem('orgaoLogado', orgao);
        
        // Esconde a mensagem de erro, caso estivesse aparecendo
        errorMsg.style.display = 'none';
        
        // Redireciona para o painel (vamos criar na próxima etapa)
        window.location.href = 'painel.html'; 
    } else {
        // Mostra a mensagem de erro
        errorMsg.style.display = 'block';
    }
}