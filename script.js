// Dados temporários (simulando um banco de dados)
let caminhoes = [];

// Função para registrar entrada/saída
document.getElementById('form-registro').addEventListener('submit', function (event) {
    event.preventDefault();

    // Captura os dados do formulário
    const placa = document.getElementById('placa').value;
    const motorista = document.getElementById('motorista').value;
    const tipo = document.getElementById('tipo').value;

    // Cria um objeto com os dados
    const caminhao = {
        placa: placa,
        motorista: motorista,
        tipo: tipo,
        status: tipo === 'entrada' ? 'Aguardando Carregamento' : 'Saída Registrada',
        horario: new Date().toLocaleTimeString()
    };

    // Adiciona o caminhão à lista
    caminhoes.push(caminhao);

    // Atualiza a tabela de status
    atualizarTabela();

    // Limpa o formulário
    event.target.reset();
});

// Função para atualizar a tabela de status
function atualizarTabela() {
    const tbody = document.querySelector('#tabela-status tbody');
    tbody.innerHTML = ''; // Limpa a tabela

    caminhoes.forEach(caminhao => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${caminhao.placa}</td>
            <td>${caminhao.motorista}</td>
            <td>${caminhao.status}</td>
            <td>${caminhao.horario}</td>
        `;

        tbody.appendChild(row);
    });
}
