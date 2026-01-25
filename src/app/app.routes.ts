import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell.component';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { HomeComponent } from './features/home/home.component';
import { ComingSoonComponent } from './features/coming-soon/coming-soon.component';
import { TransactionsComponent } from './features/transactions/transactions.component';
import { RecorrenciasComponent } from './features/recorrencias/recorrencias.component';
import { OrcamentosComponent } from './features/orcamentos/orcamentos.component';
import { MetasComponent } from './features/metas/metas.component';
import { ExportacaoComponent } from './features/exportacao/exportacao.component';
import { ImportacaoComponent } from './features/importacao/importacao.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
    {
        path: 'login',
        component: LoginComponent,
        title: 'Entrar',
        canActivate: [guestGuard]
    },
    {
        path: 'cadastro',
        component: RegisterComponent,
        title: 'Cadastro',
        canActivate: [guestGuard]
    },
    {
        path: '',
        component: ShellComponent,
        canActivate: [authGuard],
        children: [
            {
                path: '',
                component: HomeComponent,
                title: 'Resumo mensal'
            },
            {
                path: 'dashboard',
                component: DashboardComponent,
                title: 'Dashboard'
            },
            {
                path: 'transacoes',
                component: TransactionsComponent,
                title: 'Nova transação'
            },
            {
                path: 'recorrencias',
                component: RecorrenciasComponent,
                title: 'Recorrências'
            },
            {
                path: 'orcamentos',
                component: OrcamentosComponent,
                title: 'Orçamentos'
            },
            {
                path: 'metas',
                component: MetasComponent,
                title: 'Metas'
            },
            {
                path: 'exportar',
                component: ExportacaoComponent,
                title: 'Exportar'
            },
            {
                path: 'importar',
                component: ImportacaoComponent,
                title: 'Importar'
            },
            {
                path: 'em-breve',
                component: ComingSoonComponent,
                title: 'Em breve'
            }
        ]
    }
];
